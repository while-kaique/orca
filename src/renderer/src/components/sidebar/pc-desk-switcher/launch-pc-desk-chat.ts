import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { resolveDefaultAgentForNewTab } from '@/lib/agent-tab-shortcuts'
import { getRepoMainWorktreeId } from '../../../../../shared/worktree/id'
import { ensurePcDeskRepo } from './open-pc-desk-folder'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'

/** Opens one more agent chat in the workspace — a new process, so it has its own memory and row. */
export function launchPcDeskChat(worktreeId: string): boolean {
  const state = useAppStore.getState()
  const agent = resolveDefaultAgentForNewTab({
    defaultTuiAgent: state.settings?.defaultTuiAgent ?? 'claude',
    detectedAgentIds: state.detectedAgentIds,
    disabledTuiAgents: state.settings?.disabledTuiAgents
  })
  if (!agent) {
    toast.error('Nenhum agente instalado para abrir o chat.')
    return false
  }
  const result = launchAgentInNewTab({
    agent,
    worktreeId,
    groupId:
      state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id,
    launchSource: 'shortcut'
  })
  if (!result) {
    toast.error('Não consegui abrir o chat novo.')
    return false
  }
  return true
}

/** "+" pick: adds the folder as a project if needed, then opens a new chat in it. */
export async function openPcDeskChatInFolder(row: PcDeskSwitcherRow): Promise<void> {
  const repo = await ensurePcDeskRepo(row)
  if (!repo) {
    toast.error('Não deu para abrir o projeto', { description: row.path })
    return
  }
  const worktreeId = getRepoMainWorktreeId(repo)
  // Why: the chat is the first surface; without this an empty workspace also gets a bare shell.
  const activated = activateAndRevealWorktree(worktreeId, { providesInitialSurface: true })
  if (activated === false) {
    toast.error('Não deu para abrir o projeto', { description: repo.displayName })
    return
  }
  launchPcDeskChat(worktreeId)
}
