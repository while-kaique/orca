import { isExplicitAgentStatusFresh } from '@/lib/agent-status'
import { migrationUnsupportedToAgentStatusEntry } from '@/lib/migration-unsupported-agent-entry'
import { parseAgentStatusPaneIdentity } from '@/lib/agent-status-worktree-attribution'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../../../../shared/agent-status-types'
import {
  applyLiveAgentState,
  type AgentActivityInput,
  type WorktreeAgentActivitySummary
} from '../worktree-agent-activity-summary'

export type AgentActivityFlags = Omit<
  WorktreeAgentActivitySummary,
  'agentStatusPaneIdsByTabId' | 'stalePaneIdsByTabId'
>

/**
 * Fork (PC-desk): the same flags as the worktree summary, but only for the panes of one chat
 * tab, so a sidebar row that stands for one chat shows that chat's dot.
 */
export function selectPcDeskChatAgentActivityFlags(
  state: AgentActivityInput,
  worktreeId: string,
  tabId: string
): AgentActivityFlags {
  const flags: WorktreeAgentActivitySummary = {
    hasPermission: false,
    hasLiveWorking: false,
    hasLiveMonitoring: false,
    hasInterrupted: false,
    hasLiveDone: false,
    hasRetainedDone: false,
    agentStatusPaneIdsByTabId: {},
    stalePaneIdsByTabId: {}
  }
  const isThisTab = (paneKey: string | undefined): boolean =>
    parseAgentStatusPaneIdentity(paneKey)?.tabId === tabId
  const now = Date.now()
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    if (
      isThisTab(paneKey) &&
      !entry.restoredUnconfirmed &&
      isExplicitAgentStatusFresh(entry, now, AGENT_STATUS_STALE_AFTER_MS)
    ) {
      applyLiveAgentState(flags, entry)
    }
  }
  for (const unsupported of Object.values(state.migrationUnsupportedByPtyId ?? {})) {
    const entry = migrationUnsupportedToAgentStatusEntry(unsupported)
    if (entry && isThisTab(entry.paneKey)) {
      flags.hasPermission = true
    }
  }
  for (const retained of Object.values(state.retainedAgentsByPaneKey ?? {})) {
    if (retained.worktreeId === worktreeId && isThisTab(retained.entry?.paneKey)) {
      flags.hasRetainedDone = true
    }
  }
  const { agentStatusPaneIdsByTabId: _paneIds, stalePaneIdsByTabId: _stale, ...rest } = flags
  return rest
}
