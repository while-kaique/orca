import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { resolvePcDeskMainWorktreeId } from './pc-desk-main-worktree-id'
import { upsertAddedRepoWithProjectHostSetup } from '../project-admission/completion/add-repo-store-upsert'
import { launchPcDeskChat, type PcDeskChatMode } from './launch-pc-desk-chat'

/** Creates Desktop\Projetos\<name> as a git project (reuses repos:create) and opens a chat in it. */
export async function createPcDeskProject(
  rootPath: string,
  rawName: string,
  mode: PcDeskChatMode
): Promise<boolean> {
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
  const worktreeId = resolvePcDeskMainWorktreeId(repo)
  if (activateAndRevealWorktree(worktreeId, { providesInitialSurface: true }) !== false) {
    launchPcDeskChat(worktreeId, mode)
  }
  toast.success('Projeto criado', { description: repo.displayName })
  return true
}
