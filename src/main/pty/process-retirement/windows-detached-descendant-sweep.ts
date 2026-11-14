import {
  readWindowsProcessIdentityTableFresh,
  type WindowsProcessIdentityRow
} from '../../windows/windows-process-table'
import { readOrcaChromiumProcessPids } from './orca-chromium-process-pids'

/** A process captured under a terminal root: its PID plus creation time, so a recycled PID is never mistaken for it. */
export type WindowsDescendantIdentity = { pid: number; creationTimeMs: number }

export type WindowsIdentityTableReader = () => Promise<readonly WindowsProcessIdentityRow[]>

export const WINDOWS_DESCENDANT_SNAPSHOT_TIMEOUT_MS = 3_000

async function readBeforeDeadline(
  readTable: WindowsIdentityTableReader,
  timeoutMs: number
): Promise<readonly WindowsProcessIdentityRow[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
    timer.unref?.()
  })
  try {
    return await Promise.race([readTable().catch(() => null), deadline])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Every descendant of `rootPid` with a known creation time. A child older than its parent is a recycled PID that
 * only names the parent by accident, so its branch is skipped. Null when the root is missing or ambiguous.
 */
export function collectWindowsDescendants(
  rootPid: number,
  rows: readonly WindowsProcessIdentityRow[]
): WindowsDescendantIdentity[] | null {
  const roots = rows.filter((row) => row.pid === rootPid)
  if (roots.length !== 1 || roots[0].creationTimeMs === undefined) {
    return null
  }
  const childrenByPpid = new Map<number, WindowsProcessIdentityRow[]>()
  for (const row of rows) {
    if (row.pid !== rootPid) {
      childrenByPpid.set(row.ppid, [...(childrenByPpid.get(row.ppid) ?? []), row])
    }
  }
  const found: WindowsDescendantIdentity[] = []
  const visited = new Set([rootPid])
  const queue: WindowsProcessIdentityRow[] = [roots[0]]
  for (let next = 0; next < queue.length; next += 1) {
    const parent = queue[next]
    for (const child of childrenByPpid.get(parent.pid) ?? []) {
      if (
        visited.has(child.pid) ||
        child.creationTimeMs === undefined ||
        child.creationTimeMs < (parent.creationTimeMs ?? Number.POSITIVE_INFINITY)
      ) {
        continue
      }
      visited.add(child.pid)
      found.push({ pid: child.pid, creationTimeMs: child.creationTimeMs })
      queue.push(child)
    }
  }
  return found
}

/** Captured before the terminal's job is ended: a tool an agent started detached can break away from that job. */
export async function captureWindowsDescendants(
  rootPid: number,
  deps: { readTable?: WindowsIdentityTableReader; timeoutMs?: number } = {}
): Promise<WindowsDescendantIdentity[] | null> {
  const rows = await readBeforeDeadline(
    deps.readTable ?? readWindowsProcessIdentityTableFresh,
    deps.timeoutMs ?? WINDOWS_DESCENDANT_SNAPSHOT_TIMEOUT_MS
  )
  return rows ? collectWindowsDescendants(rootPid, rows) : null
}

/**
 * Ends, one PID at a time, each captured descendant still alive as the same process (same creation time).
 * Never by name, never Orca itself or its Chromium children. Returns the PIDs it ended.
 */
export async function terminateWindowsDescendantSurvivors(
  captured: readonly WindowsDescendantIdentity[],
  deps: {
    readTable?: WindowsIdentityTableReader
    timeoutMs?: number
    kill?: (pid: number) => void
    ownerPid?: number
    ownChromiumPids?: ReadonlySet<number>
  } = {}
): Promise<number[]> {
  if (captured.length === 0) {
    return []
  }
  const rows = await readBeforeDeadline(
    deps.readTable ?? readWindowsProcessIdentityTableFresh,
    deps.timeoutMs ?? WINDOWS_DESCENDANT_SNAPSHOT_TIMEOUT_MS
  )
  if (!rows) {
    return []
  }
  const ownerPid = deps.ownerPid ?? process.pid
  const ownChromium = deps.ownChromiumPids ?? readOrcaChromiumProcessPids()
  const kill = deps.kill ?? ((pid: number) => process.kill(pid))
  const ended: number[] = []
  for (const target of captured) {
    const live = rows.filter((row) => row.pid === target.pid)
    if (
      live.length !== 1 ||
      live[0].creationTimeMs !== target.creationTimeMs ||
      target.pid === ownerPid ||
      ownChromium.has(target.pid)
    ) {
      continue
    }
    try {
      kill(target.pid)
      ended.push(target.pid)
    } catch {
      // It exited between the read and the kill.
    }
  }
  return ended
}
