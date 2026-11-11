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

/** Fork: "hierarquico" opens the project's PO (Fable) from skills/hierarquia; "livre" is a plain chat. */
export type PcDeskChatMode = 'hierarquico' | 'livre'

const PO_LAUNCH = {
  agentArgs: '--model fable',
  prompt:
    'Voce e o PO deste projeto. Rode: hierarquia criar-po, leia o seu papel e os arquivos que ele indicar, e aguarde o briefing do Kaique. Nao crie chats nem mexa no projeto antes disso.'
}

/** Opens one more agent chat in the workspace — a new process, so it has its own memory and row. */
export function launchPcDeskChat(worktreeId: string, mode: PcDeskChatMode = 'livre'): boolean {
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
  const po = mode === 'hierarquico' && agent === 'claude' ? PO_LAUNCH : null
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
export function openPcDeskChatInRepo(
  repo: Pick<Repo, 'id' | 'path' | 'displayName'>,
  mode: PcDeskChatMode = 'livre'
): void {
  const worktreeId = resolvePcDeskMainWorktreeId(repo)
  // Why: the chat is the first surface; without this an empty workspace also gets a bare shell.
  const activated = activateAndRevealWorktree(worktreeId, { providesInitialSurface: true })
  if (activated === false) {
    toast.error('Não deu para abrir o projeto', { description: repo.displayName })
    return
  }
  launchPcDeskChat(worktreeId, mode)
}

/** "+" pick: adds the folder as a project if needed, then opens a new chat in it. */
export async function openPcDeskChatInFolder(
  row: PcDeskSwitcherRow,
  mode: PcDeskChatMode
): Promise<void> {
  const repo = await ensurePcDeskRepo(row)
  if (!repo) {
    toast.error('Não deu para abrir o projeto', { description: row.path })
    return
  }
  openPcDeskChatInRepo(repo, mode)
}
