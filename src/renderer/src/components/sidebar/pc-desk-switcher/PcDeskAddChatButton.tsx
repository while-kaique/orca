import React from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { resolveDefaultAgentForNewTab } from '@/lib/agent-tab-shortcuts'

/** PC-desk mode: opens one more agent chat (its own session) in the project picked above. */
export function PcDeskAddChatButton(): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const projectName = useAppStore((s) => {
    const worktree = s.activeWorktreeId ? findWorktreeById(s, s.activeWorktreeId) : null
    return worktree
      ? (s.repos.find((repo) => repo.id === worktree.repoId)?.displayName ?? null)
      : null
  })

  const handleClick = (): void => {
    if (!activeWorktreeId) {
      return
    }
    const state = useAppStore.getState()
    const agent = resolveDefaultAgentForNewTab({
      defaultTuiAgent: state.settings?.defaultTuiAgent ?? 'claude',
      detectedAgentIds: state.detectedAgentIds,
      disabledTuiAgents: state.settings?.disabledTuiAgents
    })
    if (!agent) {
      toast.error('Nenhum agente instalado para abrir o chat.')
      return
    }
    // Why a new tab: each launch is a fresh agent process, so the new chat has its own memory.
    const result = launchAgentInNewTab({
      agent,
      worktreeId: activeWorktreeId,
      groupId:
        state.activeGroupIdByWorktree[activeWorktreeId] ??
        state.groupsByWorktree[activeWorktreeId]?.[0]?.id,
      launchSource: 'shortcut'
    })
    if (!result) {
      toast.error('Não consegui abrir o chat novo.')
    }
  }

  return (
    <div className="shrink-0 px-2 pb-2">
      <button
        type="button"
        disabled={!activeWorktreeId}
        onClick={handleClick}
        title={projectName ? `Novo chat em ${projectName}` : 'Escolha um projeto primeiro'}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-sidebar-accent/25 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" />
        Adicionar Chat
      </button>
    </div>
  )
}
