// Fork (PC-desk, o-043): after a crash, a chat can keep running in the terminal daemon with no tab left to show it.
// On reopen, a session that predates this Orca and that no saved tab references is ended and reported, never kept.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export type HiddenSessionCandidate = {
  sessionId: string
  paneKey?: string
  pid: number | null
  cwd: string | null
  createdAt: number
  isAlive: boolean
  foregroundProcess?: string
}

/** Tab ids and pty ids the saved workspace session still points at (tabs and split panes). */
export function referencedTerminalIds(session: unknown): {
  tabIds: Set<string>
  ptyIds: Set<string>
} {
  const tabIds = new Set<string>()
  const ptyIds = new Set<string>()
  const saved = (session ?? {}) as {
    tabsByWorktree?: Record<string, { id?: string; ptyId?: string | null }[] | undefined>
    terminalLayoutsByTabId?: Record<
      string,
      { ptyIdsByLeafId?: Record<string, string | null> } | undefined
    >
  }
  for (const tabs of Object.values(saved.tabsByWorktree ?? {})) {
    for (const tab of tabs ?? []) {
      if (tab?.id) {
        tabIds.add(tab.id)
      }
      if (tab?.ptyId) {
        ptyIds.add(tab.ptyId)
      }
    }
  }
  for (const [tabId, layout] of Object.entries(saved.terminalLayoutsByTabId ?? {})) {
    tabIds.add(tabId)
    for (const ptyId of Object.values(layout?.ptyIdsByLeafId ?? {})) {
      if (ptyId) {
        ptyIds.add(ptyId)
      }
    }
  }
  return { tabIds, ptyIds }
}

/** Live sessions born before this Orca opened that no saved tab or pane references. Fresh sessions are never touched. */
export function findHiddenSessions(
  sessions: readonly HiddenSessionCandidate[],
  referenced: { tabIds: Set<string>; ptyIds: Set<string> },
  orcaOpenedAtMs: number
): HiddenSessionCandidate[] {
  return sessions.filter((session) => {
    const tabId = session.paneKey?.split(':')[0]
    return (
      session.isAlive &&
      session.createdAt < orcaOpenedAtMs &&
      !referenced.ptyIds.has(session.sessionId) &&
      !(tabId && referenced.tabIds.has(tabId))
    )
  })
}

/** Where the hierarchy reads which hidden chats were ended (`hierarquia retomar` warns their creators). */
export function hiddenSessionsReportPath(): string {
  return join(app.getPath('userData'), 'fork-chats-escondidos.json')
}

/** Ends each hidden session and writes the report; returns how many were ended. */
export async function endHiddenSessions(args: {
  sessions: readonly HiddenSessionCandidate[]
  session: unknown
  orcaOpenedAtMs: number
  shutdown: (sessionId: string) => Promise<void>
}): Promise<number> {
  const hidden = findHiddenSessions(
    args.sessions,
    referencedTerminalIds(args.session),
    args.orcaOpenedAtMs
  )
  const ended = []
  for (const session of hidden) {
    try {
      await args.shutdown(session.sessionId)
      ended.push({ ...session, tabId: session.paneKey?.split(':')[0] ?? null, endedAt: Date.now() })
    } catch {
      // A session that will not end stays out of the report; the next reopen tries again.
    }
  }
  if (ended.length > 0) {
    writeFileSync(hiddenSessionsReportPath(), JSON.stringify({ ended }, null, 2))
  }
  return ended.length
}
