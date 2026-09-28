import type { AppState } from '@/store'
import { parseAgentStatusPaneIdentity } from '@/lib/agent-status-worktree-attribution'

type UnseenDoneInput = Pick<
  AppState,
  | 'tabsByWorktree'
  | 'agentStatusByPaneKey'
  | 'retainedAgentsByPaneKey'
  | 'acknowledgedAgentsByPaneKey'
>

/**
 * True when an agent in this worktree finished a turn the user has not looked at yet.
 * Same rule as the bold agent rows: the last ack is older than the turn's stateStartedAt.
 * `chatTabId` narrows it to one chat tab (a sidebar row per chat).
 */
export function selectWorktreeHasUnseenDone(
  state: UnseenDoneInput,
  worktreeId: string,
  chatTabId: string | null = null
): boolean {
  const acks = state.acknowledgedAgentsByPaneKey
  const worktreeTabs = state.tabsByWorktree[worktreeId]
  const tabs = chatTabId ? worktreeTabs?.filter((tab) => tab.id === chatTabId) : worktreeTabs
  if (tabs && tabs.length > 0) {
    const tabIds = new Set(tabs.map((tab) => tab.id))
    for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
      if (entry.state !== 'done' || entry.interrupted === true) {
        continue
      }
      const identity = parseAgentStatusPaneIdentity(paneKey)
      if (identity && tabIds.has(identity.tabId) && (acks[paneKey] ?? 0) < entry.stateStartedAt) {
        return true
      }
    }
  }
  for (const [paneKey, retained] of Object.entries(state.retainedAgentsByPaneKey ?? {})) {
    if (
      retained.worktreeId === worktreeId &&
      (!chatTabId || parseAgentStatusPaneIdentity(paneKey)?.tabId === chatTabId) &&
      (acks[paneKey] ?? 0) < retained.entry.stateStartedAt
    ) {
      return true
    }
  }
  return false
}
