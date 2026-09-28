import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { resolveWorktreeStatus, type WorktreeStatus } from '@/lib/worktree-status'
import { EMPTY_BROWSER_TABS, EMPTY_TABS } from './WorktreeCardHelpers'
import {
  selectLivePtyIdsForWorktree,
  selectTerminalLayoutRootsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from './worktree-card-status-inputs'
import { selectWorktreeAgentActivitySummary } from './worktree-agent-activity-summary'
import { selectPcDeskChatAgentActivityFlags } from './pc-desk-switcher/pc-desk-chat-agent-activity'

/** `chatTabId` (fork, PC-desk) narrows the status to one chat tab of the workspace. */
export function useWorktreeActivityStatus(
  worktreeId: string,
  chatTabId: string | null = null
): WorktreeStatus {
  const worktreeTabs = useAppStore((s) => s.tabsByWorktree[worktreeId] ?? EMPTY_TABS)
  const tabs = useMemo(
    () => (chatTabId ? worktreeTabs.filter((tab) => tab.id === chatTabId) : worktreeTabs),
    [worktreeTabs, chatTabId]
  )
  const browserTabs = useAppStore((s) => s.browserTabsByWorktree[worktreeId] ?? EMPTY_BROWSER_TABS)
  const runtimePaneTitlesForWorktree = useAppStore(
    useShallow((s) => selectRuntimePaneTitlesForWorktree(s, worktreeId))
  )
  const ptyIdsForWorktree = useAppStore(
    useShallow((s) => selectLivePtyIdsForWorktree(s, worktreeId))
  )
  const terminalLayoutRootsByTabId = useAppStore(
    useShallow((s) => selectTerminalLayoutRootsForWorktree(s, worktreeId))
  )
  const { agentStatusPaneIdsByTabId, stalePaneIdsByTabId, ...worktreeFlags } = useAppStore(
    useShallow((s) => selectWorktreeAgentActivitySummary(s, worktreeId))
  )
  const chatFlags = useAppStore(
    useShallow((s) =>
      chatTabId ? selectPcDeskChatAgentActivityFlags(s, worktreeId, chatTabId) : null
    )
  )
  const {
    hasPermission,
    hasLiveWorking,
    hasLiveMonitoring,
    hasInterrupted,
    hasLiveDone,
    hasRetainedDone
  } = chatFlags ?? worktreeFlags

  // Why: compact and detailed cards need the same status-dot semantics:
  // runtime liveness gates title-derived states, then explicit agent rows can
  // promote working/permission/done so the dot matches visible agent state.
  return useMemo(
    () =>
      resolveWorktreeStatus({
        tabs,
        browserTabs,
        ptyIdsByTabId: ptyIdsForWorktree,
        runtimePaneTitlesByTabId: runtimePaneTitlesForWorktree,
        agentStatusPaneIdsByTabId,
        stalePaneIdsByTabId,
        terminalLayoutRootsByTabId,
        hasPermission,
        hasLiveWorking,
        hasLiveMonitoring,
        hasInterrupted,
        hasLiveDone,
        hasRetainedDone
      }),
    [
      tabs,
      browserTabs,
      ptyIdsForWorktree,
      runtimePaneTitlesForWorktree,
      agentStatusPaneIdsByTabId,
      stalePaneIdsByTabId,
      terminalLayoutRootsByTabId,
      hasPermission,
      hasLiveWorking,
      hasLiveMonitoring,
      hasInterrupted,
      hasLiveDone,
      hasRetainedDone
    ]
  )
}
