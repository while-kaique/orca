import type { GitWorktreeInfo } from '../../../../shared/worktree/types'
import { waitForPromiseWithSignal } from '../../../../shared/abort-signal-reason'

// Orca enxuto: startup runs 3 overlapping `git worktree list` sweeps (renderer refresh,
// permission-root cache, PTY hydration) that never shared a result. On this PC every git
// spawn costs 0.2-2 s (antivirus), so identical reads within a few seconds share one spawn.
const RESULT_TTL_MS = 3_000

type Entry = {
  promise: Promise<GitWorktreeInfo[]>
  settledAt: number | null
}

const entries = new Map<string, Entry>()
let enabled = !process.env.VITEST

function keyFor(repoPath: string, wslDistro: string | undefined): string {
  return `${repoPath}\0${wslDistro ?? ''}`
}

function cloneList(list: GitWorktreeInfo[]): GitWorktreeInfo[] {
  return list.map((worktree) => ({ ...worktree }))
}

export function readWorktreeListShared(
  repoPath: string,
  wslDistro: string | undefined,
  signal: AbortSignal | undefined,
  run: () => Promise<GitWorktreeInfo[]>
): Promise<GitWorktreeInfo[]> {
  if (!enabled) {
    return run()
  }
  const key = keyFor(repoPath, wslDistro)
  const existing = entries.get(key)
  const fresh =
    existing && (existing.settledAt === null || Date.now() - existing.settledAt < RESULT_TTL_MS)
  if (existing && fresh) {
    const shared = existing.promise.then(cloneList)
    return signal ? waitForPromiseWithSignal(shared, signal) : shared
  }
  if (signal) {
    // An abortable spawn must not seed a shared entry: its abort would reject every joiner.
    return run()
  }
  const entry: Entry = { promise: run(), settledAt: null }
  entries.set(key, entry)
  entry.promise.then(
    () => {
      entry.settledAt = Date.now()
    },
    () => {
      // Never reuse a failure: the next caller spawns again with its own error handling.
      if (entries.get(key) === entry) {
        entries.delete(key)
      }
    }
  )
  return entry.promise.then(cloneList)
}

/** Worktree add/move/remove must never be answered from a pre-mutation listing. */
export function invalidateWorktreeListResults(repoPath: string): void {
  const prefix = `${repoPath}\0`
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) {
      entries.delete(key)
    }
  }
}

export function _setWorktreeListResultCacheEnabledForTests(value: boolean): void {
  enabled = value
  entries.clear()
}
