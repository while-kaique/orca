import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { getRepoMainWorktreeId } from '../../../../../shared/worktree/id'
import { upsertAddedRepoWithProjectHostSetup } from '../add-repo-store-upsert'
import { launchPcDeskChat } from './launch-pc-desk-chat'

/** Creates Desktop\Projetos\<name> as a git project (reuses repos:create) and opens a chat in it. */
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
  const worktreeId = getRepoMainWorktreeId(repo)
  if (activateAndRevealWorktree(worktreeId, { providesInitialSurface: true }) !== false) {
    launchPcDeskChat(worktreeId)
  }
  toast.success('Projeto criado', { description: repo.displayName })
  return true
}
