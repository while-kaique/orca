import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import type { WorktreeStatus } from '@/lib/worktree-status'
import type { CanvasHierarchyRole } from '../../../../shared/canvas-hierarchy'

export type LaunchStep = 1 | 2 | 3
export type LaunchProblemReason = 'terminal' | 'agent' | 'registry' | 'never-started' | 'no-request'

export type LaunchProblem = { step: LaunchStep; reason: LaunchProblemReason }

/** What the flowchart remembers about a PO chat it saw being launched; lives only in this window's memory. */
export type LaunchRecord = {
  tabId: string
  worktreeId: string
  since: number
  launchText: string
  hadTerminal: boolean
  /** The agent was "working" at least once since the launch: only a "done" after that ends the first turn. */
  sawWorking: boolean
  /** When the agent first reported any state: the clock of the "launch request never arrived" failure. */
  runningSince: number | null
  /** When the first turn (a "done" after "working") finished while the chat was still not registered as PO. */
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
export const LAUNCH_NO_REQUEST_MS = 120_000
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

/**
 * Keeps the record up to date from the store itself, so the facts survive the flowchart not being on
 * screen: drops the record of a closed tab, and notes the first agent state and the first "working".
 */
function watchLaunchTabs(): void {
  if (watchingTabs) {
    return
  }
  watchingTabs = true
  useAppStore.subscribe((state, previous) => {
    if (records.size === 0) {
      return
    }
    let changed = false
    if (state.tabsByWorktree !== previous.tabsByWorktree) {
      for (const record of records.values()) {
        const stillOpen = (state.tabsByWorktree[record.worktreeId] ?? []).some(
          (tab) => tab.id === record.tabId
        )
        if (!stillOpen) {
          records.delete(record.tabId)
          changed = true
        }
      }
    }
    if (state.agentStatusByPaneKey !== previous.agentStatusByPaneKey) {
      const entries = Object.values(state.agentStatusByPaneKey)
      for (const record of records.values()) {
        const own = entries.filter((entry) => entry.tabId === record.tabId)
        const next = { ...record }
        if (own.length > 0 && next.runningSince === null) {
          next.runningSince = Date.now()
        }
        if (own.some((entry) => entry.state === 'working')) {
          next.sawWorking = true
        }
        if (next.runningSince !== record.runningSince || next.sawWorking !== record.sawWorking) {
          records.set(record.tabId, next)
          changed = true
        }
      }
    }
    if (changed) {
      emit()
    }
  })
}

export type LaunchRegistration = {
  tabId: string
  worktreeId: string
  launchText: string
  /** Fixtures only: start the record as if these facts had already been seen. */
  seen?: Partial<Pick<LaunchRecord, 'sawWorking' | 'runningSince'>>
}

export function registerLaunchRecord(args: LaunchRegistration): void {
  const { seen, ...base } = args
  records.set(args.tabId, {
    ...base,
    since: Date.now(),
    hadTerminal: false,
    sawWorking: false,
    runningSince: null,
    turnEndedAt: null,
    problem: null,
    ...seen
  })
  watchLaunchTabs()
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

/** An early "done" (agent idle before it handled the launch text) is not a finished turn: it needs a "working" first. */
export const isFirstTurnDone = (record: LaunchRecord, status: WorktreeStatus): boolean =>
  status === 'done' && record.sawWorking

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
  const worked = record.sawWorking || status === 'working'
  const turnDone = record.turnEndedAt !== null || (status === 'done' && worked)
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
  if (
    step === 2 &&
    !worked &&
    record.runningSince !== null &&
    now - record.runningSince >= LAUNCH_NO_REQUEST_MS
  ) {
    return problem('no-request')
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
    const record = records.get(tabId)
    if (record && record.turnEndedAt === null && isFirstTurnDone(record, status)) {
      updateLaunchRecord(tabId, { turnEndedAt: Date.now() })
    }
  }, [tabId, status])
  useEffect(() => {
    if (status === 'working') {
      updateLaunchRecord(tabId, { sawWorking: true })
    }
  }, [tabId, status])
  useEffect(() => {
    if (problemStep && problemReason && !records.get(tabId)?.problem) {
      updateLaunchRecord(tabId, { problem: { step: problemStep, reason: problemReason } })
    }
  }, [tabId, problemStep, problemReason])
}
