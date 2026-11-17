// Fork (o-051): the close by X suspends every local Claude chat through the card's Suspend path, then saves again.
import { useAppStore } from '@/store'
import { runWithWindowCloseCheckpointScope } from '@/components/window-close-request-coordinator'
import { ORCA_RENDERER_UNLOAD_PREVENTED_EVENT } from '../../../../../shared/renderer-shutdown-events'
import { FORK_SUSPEND_ALL_WINDOW_KEY } from '../../../../../shared/fork-suspender-todos'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import { findChatPane, isLocalChatPane, suspendPcDeskChat } from './suspend-pc-desk-chat'

export type ChatToSuspend = { worktreeId: string; tabId: string }
export type SuspendAllReport = { suspended: number; notSuspended: number; timedOut: boolean }

type ChatsState = Parameters<typeof findChatPane>[1] & {
  tabsByWorktree: Record<string, { id: string }[] | undefined>
}

/** Every local Claude chat of every project, visible or hidden tab; a shell has no agent row, so it never shows up. */
export function selectLocalClaudeChats(
  state: ChatsState,
  isLocal: (worktreeId: string, ptyId: string) => boolean = (worktreeId, ptyId) =>
    isLocalChatPane(useAppStore.getState(), worktreeId, { ptyId })
): ChatToSuspend[] {
  const worktreeByTab = new Map<string, string>()
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    for (const tab of tabs ?? []) {
      worktreeByTab.set(tab.id, worktreeId)
    }
  }
  const chats = new Map<string, ChatToSuspend>()
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    const tabId = parsePaneKey(paneKey)?.tabId
    const worktreeId = tabId ? worktreeByTab.get(tabId) : undefined
    if (!tabId || !worktreeId || entry.agentType !== 'claude' || chats.has(tabId)) {
      continue
    }
    const pane = findChatPane(tabId, state)
    if (pane && isLocal(worktreeId, pane.ptyId)) {
      chats.set(tabId, { worktreeId, tabId })
    }
  }
  return [...chats.values()]
}

/** Suspends all at once, waits for them or the deadline, and only then runs the final save. */
export async function suspendAllThenSave(deps: {
  chats: ChatToSuspend[]
  suspend: (chat: ChatToSuspend) => Promise<boolean>
  saveSession: () => void
  deadline: Promise<void>
}): Promise<SuspendAllReport> {
  const report: SuspendAllReport = { suspended: 0, notSuspended: 0, timedOut: false }
  const all = Promise.all(
    deps.chats.map((chat) =>
      deps
        .suspend(chat)
        .catch(() => false)
        .then((ok) => {
          report[ok ? 'suspended' : 'notSuspended'] += 1
        })
    )
  ).then(() => 'todos' as const)
  const outcome = await Promise.race([all, deps.deadline.then(() => 'prazo' as const)])
  report.timedOut = outcome === 'prazo'
  deps.saveSession()
  return { ...report }
}

/** The first close round already staged the session before any chat was suspended; stage it again with the new state. */
function saveSessionAgain(): void {
  window.dispatchEvent(new Event(ORCA_RENDERER_UNLOAD_PREVENTED_EVENT))
  runWithWindowCloseCheckpointScope(() =>
    window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
  )
}

export function installSuspendAllOnWindow(): () => void {
  const target = window as unknown as Record<string, unknown>
  target[FORK_SUSPEND_ALL_WINDOW_KEY] = (prazoMs: number): Promise<SuspendAllReport> =>
    suspendAllThenSave({
      chats: selectLocalClaudeChats(useAppStore.getState()),
      suspend: (chat) => suspendPcDeskChat(chat.worktreeId, chat.tabId, { quiet: true }),
      saveSession: saveSessionAgain,
      deadline: new Promise((resolve) => setTimeout(resolve, prazoMs))
    })
  return () => {
    delete target[FORK_SUSPEND_ALL_WINDOW_KEY]
  }
}
