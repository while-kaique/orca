import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { getRepoMainWorktreeId } from '../../../../../shared/worktree/id'
import { upsertAddedRepoWithProjectHostSetup } from '../add-repo-store-upsert'

/** Creates Desktop\Projetos\<name> as a git project (reuses repos:create) and opens it. */
export async function createPcDeskProject(rootPath: string, rawName: string): Promise<boolean> {
  const name = rawName.trim()
  if (!name || !rootPath) {
    return false
  }
  const result = await window.api.repos.create({
    parentPath: rootPath,
    name,
    kind: 'git'
  })
  if ('error' in result) {
    toast.error('Não deu para criar o projeto', { description: result.error })
    return false
  }
  const { repo } = upsertAddedRepoWithProjectHostSetup(result.repo)
  await useAppStore.getState().fetchWorktrees(repo.id)
  await activateWorktreeFromSidebar(getRepoMainWorktreeId(repo))
  toast.success('Projeto criado', { description: repo.displayName })
  return true
}
