import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { resolveDefaultAgentForNewTab } from '@/lib/agent-tab-shortcuts'
import type { Repo } from '../../../../../shared/repo-types'
import { resolvePcDeskMainWorktreeId } from './pc-desk-main-worktree-id'
import { ensurePcDeskRepo } from './open-pc-desk-folder'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'

// Fork: a project with `.hierarquia` and no live PO gets its PO (Fable) from the "+", per skills/hierarquia.
const PO_LAUNCH = {
  agentArgs: '--model fable',
  prompt:
    'Voce e o PO deste projeto na hierarquia de chats. Antes de qualquer coisa rode: hierarquia criar-po e siga o que ele mandar ler.'
}

async function projectNeedsPo(path: string): Promise<boolean> {
  try {
    const [snapshot] = await window.api.repos.readCanvasHierarchy([path])
    return (
      Boolean(snapshot) && !Object.values(snapshot.chats).some((c) => c.papel === 'po' && c.ativo)
    )
  } catch {
    return false
  }
}

/** Opens one more agent chat in the workspace — a new process, so it has its own memory and row. */
export function launchPcDeskChat(worktreeId: string, asPo = false): boolean {
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
  const po = asPo && agent === 'claude' ? PO_LAUNCH : null
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent,
    ...(po ? { ...po, sessionOptionsYieldToAgentArgs: true as const } : {}),
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

/** Activates the project folder and opens a new chat in it (header "+" and the bottom "+"). */
export async function openPcDeskChatInRepo(
  repo: Pick<Repo, 'id' | 'path' | 'displayName'>
): Promise<void> {
  const asPo = await projectNeedsPo(repo.path)
  const worktreeId = resolvePcDeskMainWorktreeId(repo)
  // Why: the chat is the first surface; without this an empty workspace also gets a bare shell.
  const activated = activateAndRevealWorktree(worktreeId, { providesInitialSurface: true })
  if (activated === false) {
    toast.error('Não deu para abrir o projeto', { description: repo.displayName })
    return
  }
  launchPcDeskChat(worktreeId, asPo)
}

/** "+" pick: adds the folder as a project if needed, then opens a new chat in it. */
export async function openPcDeskChatInFolder(row: PcDeskSwitcherRow): Promise<void> {
  const repo = await ensurePcDeskRepo(row)
  if (!repo) {
    toast.error('Não deu para abrir o projeto', { description: row.path })
    return
  }
  await openPcDeskChatInRepo(repo)
}
