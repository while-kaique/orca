import type { Row } from '../worktree-list/grouping/row-types'

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
