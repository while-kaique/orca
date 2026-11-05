import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { usePcDeskMode } from '@/lib/pc-desk-mode'
import type { Row } from '../../../../../shared/sidebar-list/row-types'
import {
  parsePcDeskChatTabIdsSignature,
  selectPcDeskChatTabIdsSignature,
  splitPcDeskRowsByChat
} from './pc-desk-chat-rows'

/** PC-desk mode: only working rows, and one row per open chat; other modes keep the rows as is. */
export function usePcDeskSidebarRows(rows: Row[]): Row[] {
  const pcDeskMode = usePcDeskMode()
  const chatTabIdsSignature = useAppStore((s) =>
    pcDeskMode ? selectPcDeskChatTabIdsSignature(s) : ''
  )
  return useMemo(
    () =>
      pcDeskMode
        ? splitPcDeskRowsByChat(
            keepPcDeskWorkingRows(rows),
            parsePcDeskChatTabIdsSignature(chatTabIdsSignature)
          )
        : rows,
    [pcDeskMode, chatTabIdsSignature, rows]
  )
}

/**
 * PC-desk mode shows only what the user is working in: drop notice cards (new/imported worktrees)
 * and project headers with no open workspace under them (empty or missing-folder projects).
 */
export function keepPcDeskWorkingRows(rows: readonly Row[]): Row[] {
  const withoutNotices = rows.filter(
    (row) => row.type !== 'imported-worktrees-card' && row.type !== 'new-external-worktrees-inbox'
  )
  return withoutNotices.filter((row, index) => {
    if (row.type !== 'header' || !row.repo) {
      return true
    }
    // Why count too: a collapsed header has no item rows after it but still holds open workspaces.
    if (row.count > 0) {
      return true
    }
    const next = withoutNotices[index + 1]
    return next !== undefined && next.type !== 'header'
  })
}
