import {
  agentChildRowContextForParent,
  buildAgentChildRowModels,
  buildLegacyAgentChildRowModels,
  flattenAgentChildRowModels,
  type AgentChildRowModel
} from '../../../../shared/agent-status/presentation/agent-child-row-model'
import { agentChildWorkIsRunning } from '../../../../shared/agent-status/child-work/agent-child-work-listing'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'

function ownsLiveWork(row: AgentChildRowModel): boolean {
  return row.owned.some((owned) => !owned.settled || ownsLiveWork(owned))
}

/**
 * Fork: what still runs under a chat, from the same host records the sidebar reads. Unlike the sidebar
 * (agents only), this keeps background commands/monitors too, so a "running in background" chat shows why.
 */
export function runningChildWork(entry: AgentStatusEntry): AgentChildRowModel[] {
  const context = agentChildRowContextForParent(entry, true)
  const rows =
    entry.children !== undefined
      ? buildAgentChildRowModels(entry.children, context)
      : buildLegacyAgentChildRowModels(entry.subagents ?? [], context)
  return flattenAgentChildRowModels(rows).filter((row) =>
    agentChildWorkIsRunning({ settled: row.settled, ownsLiveWork: ownsLiveWork(row) })
  )
}
