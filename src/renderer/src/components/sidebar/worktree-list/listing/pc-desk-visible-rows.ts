import type {
  WorkspaceRowFactReader,
  WorkspaceRowFilters
} from '../../../../../../shared/workspace-view/workspace-row-filters'
import type { TerminalTab } from '../../../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../../../shared/worktree/types'

type TabsByWorktree = Record<string, Pick<TerminalTab, 'id'>[]> | null

// Fork (PC-desk): the sidebar lists only workspaces with an open chat (or live work), whatever
// the "show sleeping" setting says; the project folder itself is never hidden as a default branch.
export function pcDeskWorkspaceRowFilters(filters: WorkspaceRowFilters): WorkspaceRowFilters {
  return {
    ...filters,
    hideSleepingWorkspaces: true,
    alwaysShowDefaultBranchWorkspace: false,
    hideDefaultBranchWorkspace: false
  }
}

// Why tab count: a chat restored at boot has no live PTY yet but is still open.
export function pcDeskWorkspaceRowFacts(
  facts: WorkspaceRowFactReader<Worktree>,
  tabsByWorktree: TabsByWorktree
): WorkspaceRowFactReader<Worktree> {
  return {
    ...facts,
    isSleeping: (worktree) =>
      (tabsByWorktree?.[worktree.id]?.length ?? 0) === 0 && facts.isSleeping(worktree)
  }
}

/** Folder workspaces skip the shared row filters, so the open-chat rule is applied to them here. */
export function dropPcDeskClosedFolderRows(
  rows: Worktree[],
  facts: WorkspaceRowFactReader<Worktree>,
  forcedVisibleWorktreeIds: readonly string[] | undefined
): Worktree[] {
  const forced = new Set(forcedVisibleWorktreeIds ?? [])
  return rows.filter(
    (row) => forced.has(row.id) || !facts.isFolderWorkspace(row) || !facts.isSleeping(row)
  )
}
