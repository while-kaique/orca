import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import type { WorktreeStatus } from '@/lib/worktree-status'
import type { CanvasHierarchyRole } from '../../../../shared/canvas-hierarchy'

export type LaunchStep = 1 | 2 | 3
export type LaunchProblemReason = 'terminal' | 'agent' | 'registry' | 'never-started'

export type LaunchProblem = { step: LaunchStep; reason: LaunchProblemReason }

/** What the flowchart remembers about a PO chat it saw being launched; lives only in this window's memory. */
export type LaunchRecord = {
  tabId: string
  worktreeId: string
  since: number
  launchText: string
  hadTerminal: boolean
  /** When the first turn finished while the chat was still not registered as PO. */
  turnEndedAt: number | null
  problem: LaunchProblem | null
}

export type LaunchMaskView =
  | { kind: 'steps'; step: LaunchStep; askingPermission: boolean }
  | { kind: 'problem'; problem: LaunchProblem }

export type LaunchFacts = {
  status: WorktreeStatus
  role: CanvasHierarchyRole | null
  hasTerminal: boolean
  now: number
}

export const LAUNCH_NEVER_STARTED_MS = 120_000
// Two reads of estado.json (3 s apart) that still miss the PO: one read alone can catch the file mid-write.
export const LAUNCH_REGISTRY_GRACE_MS = 6_500
const PROMPT_MATCH_CHARS = 60

const records = new Map<string, LaunchRecord>()
const listeners = new Set<() => void>()
let watchingTabs = false

const emit = (): void => {
  for (const listener of listeners) {
    listener()
  }
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Drops the record of a tab that was closed. */
function watchClosedTabs(): void {
  if (watchingTabs) {
    return
  }
  watchingTabs = true
  useAppStore.subscribe((state, previous) => {
    if (records.size === 0 || state.tabsByWorktree === previous.tabsByWorktree) {
      return
    }
    let changed = false
    for (const record of records.values()) {
      const stillOpen = (state.tabsByWorktree[record.worktreeId] ?? []).some(
        (tab) => tab.id === record.tabId
      )
      if (!stillOpen) {
        records.delete(record.tabId)
        changed = true
      }
    }
    if (changed) {
      emit()
    }
  })
}

export function registerLaunchRecord(args: {
  tabId: string
  worktreeId: string
  launchText: string
}): void {
  records.set(args.tabId, {
    ...args,
    since: Date.now(),
    hadTerminal: false,
    turnEndedAt: null,
    problem: null
  })
  watchClosedTabs()
  emit()
}

function updateLaunchRecord(tabId: string, patch: Partial<LaunchRecord>): void {
  const record = records.get(tabId)
  if (!record) {
    return
  }
  const changed = (Object.keys(patch) as (keyof LaunchRecord)[]).some(
    (key) => record[key] !== patch[key]
  )
  if (changed) {
    records.set(tabId, { ...record, ...patch })
    emit()
  }
}

const normalized = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, PROMPT_MATCH_CHARS)

/** The first request from the user arrived when the chat's last prompt is no longer the launch text. */
function launchEnded(record: LaunchRecord, lastPrompt: string | undefined): boolean {
  return Boolean(lastPrompt) && normalized(lastPrompt ?? '') !== normalized(record.launchText)
}

const isRunning = (status: WorktreeStatus): boolean =>
  status === 'working' ||
  status === 'monitoring' ||
  status === 'permission' ||
  status === 'done' ||
  status === 'failed' ||
  status === 'interrupted'

/** The step is worked out from facts on every draw; a stopwatch only decides "something went wrong". */
export function launchMaskView(record: LaunchRecord, facts: LaunchFacts): LaunchMaskView {
  if (record.problem) {
    return { kind: 'problem', problem: record.problem }
  }
  const { status, role, hasTerminal, now } = facts
  const turnDone = record.turnEndedAt !== null || status === 'done'
  const step: LaunchStep = role === 'po' && turnDone ? 3 : isRunning(status) ? 2 : 1
  const problem = (reason: LaunchProblemReason): LaunchMaskView => ({
    kind: 'problem',
    problem: { step, reason }
  })
  if (record.hadTerminal && !hasTerminal) {
    return problem('terminal')
  }
  if (step < 3 && (status === 'failed' || status === 'interrupted')) {
    return problem('agent')
  }
  if (
    step === 2 &&
    turnDone &&
    record.turnEndedAt !== null &&
    now - record.turnEndedAt >= LAUNCH_REGISTRY_GRACE_MS
  ) {
    return problem('registry')
  }
  if (step === 1 && now - record.since > LAUNCH_NEVER_STARTED_MS) {
    return problem('never-started')
  }
  return { kind: 'steps', step, askingPermission: status === 'permission' }
}

/**
 * The launch record while the mask is still due: the record goes away once the user's first request
 * replaces the launch text in the chat's last prompt.
 */
export function useCanvasLaunchRecord(
  tabId: string,
  lastPrompt: string | undefined
): LaunchRecord | null {
  const record = useSyncExternalStore(
    subscribe,
    () => records.get(tabId),
    () => undefined
  )
  const ended = record ? launchEnded(record, lastPrompt) : false
  useEffect(() => {
    if (ended && records.delete(tabId)) {
      emit()
    }
  }, [ended, tabId])
  return record && !ended ? record : null
}

/** Keeps the few facts the live state does not keep: terminal seen, turn end, and a problem once found. */
export function useLaunchFactsKeeper(
  tabId: string,
  view: LaunchMaskView,
  facts: LaunchFacts
): void {
  const { status, hasTerminal } = facts
  const problemStep = view.kind === 'problem' ? view.problem.step : null
  const problemReason = view.kind === 'problem' ? view.problem.reason : null
  useEffect(() => {
    if (hasTerminal) {
      updateLaunchRecord(tabId, { hadTerminal: true })
    }
  }, [tabId, hasTerminal])
  useEffect(() => {
    if (status === 'done' && records.get(tabId)?.turnEndedAt === null) {
      updateLaunchRecord(tabId, { turnEndedAt: Date.now() })
    }
  }, [tabId, status])
  useEffect(() => {
    if (problemStep && problemReason && !records.get(tabId)?.problem) {
      updateLaunchRecord(tabId, { problem: { step: problemStep, reason: problemReason } })
    }
  }, [tabId, problemStep, problemReason])
}
