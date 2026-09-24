import { useAppStore } from '@/store'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import type { Repo } from '../../../../../shared/repo-types'
import { getRepoMainWorktreeId } from '../../../../../shared/worktree/id'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'

/** Adds the folder as a project on first use (no dialog), then loads its worktrees. */
export async function ensurePcDeskRepo(row: PcDeskSwitcherRow): Promise<Repo | null> {
  const state = useAppStore.getState()
  if (row.repo) {
    if (!state.worktreesByRepo[row.repo.id]) {
      await state.fetchWorktrees(row.repo.id)
    }
    return row.repo
  }
  // Why explicit kind: the default 'git' path opens a confirm dialog for plain folders.
  const repo = await state.addRepoPath(row.path, row.isGit ? 'git' : 'folder')
  if (repo) {
    await useAppStore.getState().fetchWorktrees(repo.id)
  }
  return repo
}

export async function openPcDeskFolder(row: PcDeskSwitcherRow): Promise<void> {
  const repo = await ensurePcDeskRepo(row)
  if (repo) {
    await activateWorktreeFromSidebar(getRepoMainWorktreeId(repo))
  }
}
