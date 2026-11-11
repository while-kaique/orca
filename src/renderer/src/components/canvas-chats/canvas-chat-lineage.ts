import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { buildAgentRowLineageTree } from '../dashboard/agent-row-lineage-model'
import type { CanvasChat } from './canvas-chats-layout'

export type CanvasChatLatestEntry = { paneKey: string; entry: AgentStatusEntry }

/** Who created whom, by the same lineage rule as the agents dashboard; only inside one project. */
export function linkCreatedChats(
  chats: CanvasChat[],
  latestByChat: ReadonlyMap<string, CanvasChatLatestEntry>
): void {
  const chatByPaneKey = new Map<string, CanvasChat>()
  const rows: CanvasChatLatestEntry[] = []
  for (const chat of chats) {
    const latest = latestByChat.get(chat.key)
    if (latest) {
      rows.push(latest)
      chatByPaneKey.set(latest.paneKey, chat)
    }
  }
  for (const [parentPaneKey, children] of buildAgentRowLineageTree(rows).childrenByParentPaneKey) {
    const parent = chatByPaneKey.get(parentPaneKey)
    for (const child of children) {
      const chat = chatByPaneKey.get(child.paneKey)
      if (parent && chat && chat !== parent) {
        chat.parentKey = parent.key
      }
    }
  }
}
