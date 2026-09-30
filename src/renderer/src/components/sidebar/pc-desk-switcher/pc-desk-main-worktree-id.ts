import { useAppStore } from '@/store'
import type { Repo } from '../../../../../shared/repo-types'
import { resolveRepoMainWorktreeId } from '../../../../../shared/worktree/id'

export function resolvePcDeskMainWorktreeId(repo: Pick<Repo, 'id' | 'path'>): string {
  return resolveRepoMainWorktreeId(repo, useAppStore.getState().worktreesByRepo[repo.id])
}
