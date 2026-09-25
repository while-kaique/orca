import type { AppState } from '@/store/types'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { getTabIdFromPaneKey } from '@/store/terminals/terminal-pty-identities'
import { capSessionTitle } from '../../../shared/session-title-cap'
import {
  pcDeskWorkspaceSessionTitle,
  setPcDeskSmartTitlesPreferred
} from '../../../shared/pc-desk-session-title'
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
  failures: number
  lastAssistantMessage?: string
}

const namerByTabId = new Map<string, TabNamerState>()
let tickTimer: ReturnType<typeof setInterval> | null = null
// Why injected: this module is called from inside the store, so importing it would cycle.
let readState: (() => AppState) | null = null
// Why opt-in: store tests exercise upstream title behavior, so only the real app turns this on.
let started = false

export function startPcDeskSessionNamer(): void {
  started = true
  // Why reset: a renderer hot reload re-runs startup; the next prompt re-arms the tick.
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  setPcDeskSmartTitlesPreferred(isPcDeskModeEnabled())
  // Why: the phone's workspace list is built in main, which can't read this renderer preference.
  void window.api?.repos?.setPcDeskSmartTitles?.(isPcDeskModeEnabled())
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

const FOLDER_WORKSPACE_ID_MARKER = '::workspace:'
const MAX_FIRST_NAME_FAILURES = 3

/** Where to run Haiku and what the project is called; folder workspaces aren't in worktreesByRepo. */
function workspaceTargetFor(worktreeId: string): { cwd: string; projectName: string } | null {
  const state = storeState()
  const worktree = findWorktreeById(state, worktreeId)
  const repoId = worktreeId.split('::')[0] ?? ''
  const markerAt = worktreeId.indexOf(FOLDER_WORKSPACE_ID_MARKER)
  // Folder workspace ids embed their path: `<repoId>::<path>::workspace:<folderId>`.
  const cwd = worktree?.path ?? (markerAt > 0 ? worktreeId.slice(repoId.length + 2, markerAt) : '')
  if (!cwd) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === (worktree?.repoId ?? repoId))
  const projectName =
    repo?.displayName?.trim() || worktree?.displayName?.trim() || cwd.split(/[\\/]/u).pop() || cwd
  return { cwd, projectName }
}

function currentTab(tabId: string, worktreeId: string) {
  return storeState().tabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)
}

function anchorIsGone(anchorPaneKey: string): boolean {
  return !storeState().agentStatusByPaneKey[anchorPaneKey]
}

function isRealSessionTitle(
  title: string | null | undefined,
  target: { projectName: string } | null
): boolean {
  const trimmed = title?.trim()
  return Boolean(trimmed) && (!target || trimmed !== capSessionTitle(target.projectName))
}

/** Called for every accepted agent status update; cheap unless the prompt is new. */
export function notePcDeskAgentPrompt(
  getState: () => AppState,
  input: {
    paneKey: string
    prompt: string
    worktreeId: string | undefined
    tabId: string | undefined
    assistantMessage?: string
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
      // A restored title is a real name unless it is the saved project-name placeholder.
      hasRealName: isRealSessionTitle(tab.generatedTitle, workspaceTargetFor(input.worktreeId)),
      inFlight: false,
      failures: 0
    }
    namerByTabId.set(tabId, namer)
    const target = workspaceTargetFor(input.worktreeId)
    if (!namer.hasRealName && target) {
      storeState().setPcDeskSessionTabTitle(tabId, capSessionTitle(target.projectName))
    }
    ensureTicking()
  }
  if (namer.anchorPaneKey !== input.paneKey) {
    if (!anchorIsGone(namer.anchorPaneKey)) {
      return
    }
    namer.anchorPaneKey = input.paneKey
  }
  const assistantMessage = input.assistantMessage?.trim().slice(0, PROMPT_PREVIEW_CHARS)
  const assistantChanged =
    Boolean(assistantMessage) && assistantMessage !== namer.lastAssistantMessage
  if (assistantChanged) {
    namer.lastAssistantMessage = assistantMessage
  }
  const promptIsNew = namer.prompts.at(-1) !== prompt
  if (promptIsNew) {
    namer.prompts = [...namer.prompts, prompt].slice(-RECENT_PROMPTS_KEPT)
    namer.newPromptCount += 1
  }
  // The first prompt names the tab right away; a finished reply retries a vague one ("e aí").
  if (!namer.hasRealName && !namer.inFlight && (promptIsNew || assistantChanged)) {
    void checkTab(tabId, namer)
  }
}

function isDue(namer: TabNamerState, now: number): boolean {
  if (namer.inFlight) {
    return false
  }
  // Retries the first name on the next tick if the immediate attempt failed.
  if (!namer.hasRealName) {
    return namer.newPromptCount >= 1 && namer.failures < MAX_FIRST_NAME_FAILURES
  }
  return (
    namer.newPromptCount >= MIN_NEW_PROMPTS &&
    now - namer.lastCheckAt >= CHECK_GAP_MS &&
    now - namer.lastRenameAt >= RENAME_GAP_MS
  )
}

async function checkTab(tabId: string, namer: TabNamerState): Promise<void> {
  const tab = currentTab(tabId, namer.worktreeId)
  const target = workspaceTargetFor(namer.worktreeId)
  if (!tab || !target || tab.customTitle?.trim()) {
    namerByTabId.delete(tabId)
    return
  }
  const pendingPrompts = namer.newPromptCount
  namer.inFlight = true
  namer.lastCheckAt = Date.now()
  namer.newPromptCount = 0
  try {
    const result = await window.api.repos
      .suggestPcDeskSessionTitle({
        cwd: target.cwd,
        projectName: target.projectName,
        currentTitle: tab.generatedTitle?.trim() || target.projectName,
        currentIsPlaceholder: !namer.hasRealName,
        recentPrompts: namer.prompts,
        ...(namer.lastAssistantMessage ? { lastAssistantMessage: namer.lastAssistantMessage } : {})
      })
      .catch((error: unknown) => ({ kind: 'error' as const, error: String(error) }))
    if (result.kind === 'error') {
      // Why keep the count: a failed first name must retry on the next tick, not wait for a new prompt.
      namer.failures += 1
      namer.newPromptCount += pendingPrompts
      console.warn('[pc-desk-session-namer] naming failed:', result.error)
      return
    }
    namer.failures = 0
    // The user may have renamed the tab while Haiku was thinking.
    if (result.kind === 'rename' && !currentTab(tabId, namer.worktreeId)?.customTitle?.trim()) {
      storeState().setPcDeskSessionTabTitle(tabId, result.title)
      namer.lastRenameAt = Date.now()
      namer.hasRealName = true
    }
    // A "keep" on the project-name placeholder (e.g. a bare "e aí") retries on the next prompt.
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

/** The sidebar row's name in PC-desk mode: the oldest named chat tab of the workspace. */
export { pcDeskWorkspaceSessionTitle }
