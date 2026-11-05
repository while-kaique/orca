import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/structured-agent-session-tabs'
import { isExplicitAgentStatusFresh } from '@/lib/pane-agent-evidence'
import { migrationUnsupportedToAgentStatusEntry } from '../../../../../shared/migration-unsupported-agent-entry'
import { parseAgentStatusPaneIdentity } from '../../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../../../../shared/agent-status/contracts/agent-status-freshness'
import { agentVerdictDisplayMark } from '../../../../../shared/agent-status/lifecycle/agent-main-agent-verdict'
import { applyAgentPaneActivityFlags } from '../../../../../shared/worktree-status-rollup'
import type {
  AgentActivityInput,
  WorktreeAgentActivitySummary
} from '../workspace-card/activity/worktree-agent-activity-summary'

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
  const flags: AgentActivityFlags = {
    hasPermission: false,
    hasLiveWorking: false,
    hasLiveMonitoring: false,
    hasFailed: false,
    hasInterrupted: false,
    hasUnconfirmed: false,
    hasLiveDone: false,
    hasRetainedDone: false,
    hasRetainedFailed: false
  }
  const structuredTabs = state.unifiedTabsByWorktree
    ? getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
    : undefined
  const isThisTab = (paneKey: string | undefined): boolean =>
    paneKey !== undefined &&
    parseAgentStatusPaneIdentity(paneKey, structuredTabs?.get(paneKey))?.tabId === tabId
  const now = Date.now()
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    if (
      isThisTab(paneKey) &&
      !entry.restoredUnconfirmed &&
      isExplicitAgentStatusFresh(entry, now, AGENT_STATUS_STALE_AFTER_MS)
    ) {
      applyAgentPaneActivityFlags(flags, entry)
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
      // Same split as the worktree summary: a retained failure never reads as a clean done.
      if (agentVerdictDisplayMark(retained.entry) === 'failed') {
        flags.hasRetainedFailed = true
      } else {
        flags.hasRetainedDone = true
      }
    }
  }
  return flags
}
