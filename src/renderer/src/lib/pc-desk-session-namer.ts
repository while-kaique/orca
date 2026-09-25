import type { AppState } from '@/store/types'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { getTabIdFromPaneKey } from '@/store/terminals/terminal-pty-identities'
import { capSessionTitle } from '../../../shared/session-title-cap'
import { setPcDeskSmartTitlesPreferred } from '../../../shared/pc-desk-session-title'
import { isPcDeskModeEnabled } from './pc-desk-mode'

// Fork-only: a tab starts named after its project, then Haiku renames it to what the user
// is doing now — at most once per RENAME_GAP, and only after enough new messages.
const CHECK_TICK_MS = 60_000
const CHECK_GAP_MS = 10 * 60_000
const RENAME_GAP_MS = 20 * 60_000
const MIN_NEW_PROMPTS = 3
const RECENT_PROMPTS_KEPT = 8
// Why: prompts can be paste-sized and this runs on every status update; Haiku only reads a preview.
const PROMPT_PREVIEW_CHARS = 400

type TabNamerState = {
  worktreeId: string
  /** The tab's oldest chat pane; split siblings don't steer the name. */
  anchorPaneKey: string
  prompts: string[]
  newPromptCount: number
  lastCheckAt: number
  lastRenameAt: number
  hasRealName: boolean
  inFlight: boolean
}

const namerByTabId = new Map<string, TabNamerState>()
let tickTimer: ReturnType<typeof setInterval> | null = null
// Why injected: this module is called from inside the store, so importing it would cycle.
let readState: (() => AppState) | null = null
// Why opt-in: store tests exercise upstream title behavior, so only the real app turns this on.
let started = false

export function startPcDeskSessionNamer(): void {
  started = true
  setPcDeskSmartTitlesPreferred(isPcDeskModeEnabled())
}

function isActive(): boolean {
  return started && isPcDeskModeEnabled()
}

function storeState(): AppState {
  if (!readState) {
    throw new Error('pc-desk session namer used before the store reported in')
  }
  return readState()
}

function projectNameFor(worktreeId: string): string | null {
  const state = storeState()
  const worktree = findWorktreeById(state, worktreeId)
  if (!worktree) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  return repo?.displayName?.trim() || worktree.displayName?.trim() || null
}

function currentTab(tabId: string, worktreeId: string) {
  return storeState().tabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)
}

function anchorIsGone(anchorPaneKey: string): boolean {
  return !storeState().agentStatusByPaneKey[anchorPaneKey]
}

/** Called for every accepted agent status update; cheap unless the prompt is new. */
export function notePcDeskAgentPrompt(
  getState: () => AppState,
  input: {
    paneKey: string
    prompt: string
    worktreeId: string | undefined
    tabId: string | undefined
  }
): void {
  readState = getState
  if (!isActive() || !input.prompt || !input.worktreeId) {
    return
  }
  const prompt = input.prompt.slice(0, PROMPT_PREVIEW_CHARS).trim()
  const tabId = input.tabId ?? getTabIdFromPaneKey(input.paneKey)
  if (!prompt || !tabId) {
    return
  }
  const tab = currentTab(tabId, input.worktreeId)
  if (!tab || tab.customTitle?.trim()) {
    return
  }
  let namer = namerByTabId.get(tabId)
  if (!namer) {
    const now = Date.now()
    namer = {
      worktreeId: input.worktreeId,
      anchorPaneKey: input.paneKey,
      prompts: [],
      newPromptCount: 0,
      lastCheckAt: now,
      lastRenameAt: now,
      // A title restored from a previous run is already a real name, not the placeholder.
      hasRealName: Boolean(tab.generatedTitle?.trim()),
      inFlight: false
    }
    namerByTabId.set(tabId, namer)
    const projectName = projectNameFor(input.worktreeId)
    if (!namer.hasRealName && projectName) {
      storeState().setPcDeskSessionTabTitle(tabId, capSessionTitle(projectName))
    }
    ensureTicking()
  }
  if (namer.anchorPaneKey !== input.paneKey) {
    if (!anchorIsGone(namer.anchorPaneKey)) {
      return
    }
    namer.anchorPaneKey = input.paneKey
  }
  if (namer.prompts.at(-1) === prompt) {
    return
  }
  namer.prompts = [...namer.prompts, prompt].slice(-RECENT_PROMPTS_KEPT)
  namer.newPromptCount += 1
  // The first prompt names the tab right away instead of waiting for the tick.
  if (!namer.hasRealName && !namer.inFlight) {
    void checkTab(tabId, namer)
  }
}

function isDue(namer: TabNamerState, now: number): boolean {
  if (namer.inFlight) {
    return false
  }
  // Retries the first name on the next tick if the immediate attempt failed.
  if (!namer.hasRealName) {
    return namer.newPromptCount >= 1
  }
  return (
    namer.newPromptCount >= MIN_NEW_PROMPTS &&
    now - namer.lastCheckAt >= CHECK_GAP_MS &&
    now - namer.lastRenameAt >= RENAME_GAP_MS
  )
}

async function checkTab(tabId: string, namer: TabNamerState): Promise<void> {
  const tab = currentTab(tabId, namer.worktreeId)
  const worktree = findWorktreeById(storeState(), namer.worktreeId)
  if (!tab || !worktree || tab.customTitle?.trim()) {
    namerByTabId.delete(tabId)
    return
  }
  const projectName = projectNameFor(namer.worktreeId) ?? worktree.displayName
  namer.inFlight = true
  namer.lastCheckAt = Date.now()
  namer.newPromptCount = 0
  try {
    const result = await window.api.repos.suggestPcDeskSessionTitle({
      cwd: worktree.path,
      projectName,
      currentTitle: tab.generatedTitle?.trim() || projectName,
      currentIsPlaceholder: !namer.hasRealName,
      recentPrompts: namer.prompts
    })
    if (result.kind === 'error') {
      console.warn('[pc-desk-session-namer] naming failed:', result.error)
      return
    }
    // The user may have renamed the tab while Haiku was thinking.
    if (result.kind === 'rename' && !currentTab(tabId, namer.worktreeId)?.customTitle?.trim()) {
      storeState().setPcDeskSessionTabTitle(tabId, result.title)
      namer.lastRenameAt = Date.now()
    }
    namer.hasRealName = true
  } finally {
    namer.inFlight = false
  }
}

function tick(): void {
  if (!readState || !isActive()) {
    return
  }
  const now = Date.now()
  for (const [tabId, namer] of namerByTabId) {
    if (isDue(namer, now)) {
      void checkTab(tabId, namer)
    }
  }
}

function ensureTicking(): void {
  tickTimer ??= setInterval(tick, CHECK_TICK_MS)
}
