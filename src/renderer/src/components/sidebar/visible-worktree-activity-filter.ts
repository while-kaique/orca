import type { Worktree } from '../../../../shared/worktree/types'
import { isInactiveWorkspace } from '@/lib/worktree-activity-state'
import { isSleepingSweepExemptWorkspace } from './visible-worktree-kinds'
import type { VisibleWorktreeOptions } from './visible-worktrees'

/** Drops sleeping workspaces; PC-desk mode instead keeps only workspaces with open chats. */
export function filterWorktreesByActivity(
  all: Worktree[],
  opts: VisibleWorktreeOptions,
  pcDeskMode: boolean
): Worktree[] {
  if (!pcDeskMode && opts.showSleepingWorkspaces) {
    return all
  }
  const isActive = (w: Worktree): boolean =>
    !isInactiveWorkspace(
      w.id,
      opts.tabsByWorktree,
      opts.ptyIdsByTabId,
      opts.browserTabsByWorktree,
      opts.worktreeIdsWithLiveAgent,
      opts.worktreeIdsWithStructuredChat
    )
  if (pcDeskMode) {
    // Why tab count: a chat restored at boot has no live PTY yet but is still open.
    return all.filter((w) => (opts.tabsByWorktree?.[w.id]?.length ?? 0) > 0 || isActive(w))
  }
  // Why no !hideDefaultBranchWorkspace term: that filter already ran, so an explicit hide still
  // wins over the exemption.
  return all.filter(
    (w) => isSleepingSweepExemptWorkspace(w, opts.alwaysShowDefaultBranchWorkspace) || isActive(w)
  )
}
