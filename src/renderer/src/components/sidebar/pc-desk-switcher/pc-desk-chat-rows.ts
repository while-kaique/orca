import { createContext, useContext } from 'react'
import type { AppState } from '@/store/types'
import type { Row } from '../worktree-list/grouping/row-types'

/** Worktree id → its chat (terminal tab) ids, in tab order. */
export type PcDeskChatTabIdsByWorktree = ReadonlyMap<string, readonly string[]>

const TAB_SEPARATOR = ','
const WORKTREE_SEPARATOR = '\n'

/**
 * One string per store snapshot that only changes when chats open, close or move — not on every
 * title update — so the sidebar rows are rebuilt only when the list of chats really changed.
 */
export function selectPcDeskChatTabIdsSignature(state: Pick<AppState, 'tabsByWorktree'>): string {
  const lines: string[] = []
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    if (tabs.length > 0) {
      lines.push(`${worktreeId}\t${tabs.map((tab) => tab.id).join(TAB_SEPARATOR)}`)
    }
  }
  return lines.join(WORKTREE_SEPARATOR)
}

export function parsePcDeskChatTabIdsSignature(signature: string): PcDeskChatTabIdsByWorktree {
  const map = new Map<string, readonly string[]>()
  for (const line of signature ? signature.split(WORKTREE_SEPARATOR) : []) {
    const tabIndex = line.lastIndexOf('\t')
    map.set(line.slice(0, tabIndex), line.slice(tabIndex + 1).split(TAB_SEPARATOR))
  }
  return map
}

/**
 * PC-desk mode: each chat is its own sidebar row (a "space"), so a workspace with two chats
 * shows two rows under the project. Workspaces with no chat keep their single row.
 */
export function splitPcDeskRowsByChat(
  rows: readonly Row[],
  chatTabIdsByWorktree: PcDeskChatTabIdsByWorktree
): Row[] {
  const result: Row[] = []
  for (const row of rows) {
    const tabIds = row.type === 'item' ? chatTabIdsByWorktree.get(row.worktree.id) : undefined
    if (row.type !== 'item' || !tabIds || tabIds.length === 0) {
      result.push(row)
      continue
    }
    for (const tabId of tabIds) {
      result.push({ ...row, rowKey: `${row.rowKey}#chat:${tabId}`, pcDeskTabId: tabId })
    }
  }
  return result
}

/** Set around a sidebar card that stands for one chat, so the card's title, status and X follow it. */
export const PcDeskChatTabContext = createContext<string | null>(null)

export function usePcDeskChatTabId(): string | null {
  return useContext(PcDeskChatTabContext)
}
