import { useAppStore } from '@/store'
import type { Repo } from '../../../../../shared/repo-types'
import { getRepoMainWorktreeId, worktreeIdsEqual } from '../../../../../shared/worktree/id'

/**
 * The loaded main-worktree id for a repo. Why: repos added by the CLI keep `C:\…` while git reports
 * `C:/…`, so the built id misses the store's exact-id lookup and the activation fails.
 */
export function resolvePcDeskMainWorktreeId(repo: Pick<Repo, 'id' | 'path'>): string {
  const builtId = getRepoMainWorktreeId(repo)
  const worktrees = useAppStore.getState().worktreesByRepo[repo.id] ?? []
  const match =
    worktrees.find((wt) => worktreeIdsEqual(wt.id, builtId)) ??
    worktrees.find((wt) => wt.isMainWorktree)
  return match?.id ?? builtId
}
