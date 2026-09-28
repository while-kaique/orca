import React from 'react'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { launchPcDeskChat } from './launch-pc-desk-chat'

/** PC-desk mode: opens one more agent chat (its own session and sidebar row) in the project picked above. */
export function PcDeskAddChatButton(): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const projectName = useAppStore((s) => {
    const worktree = s.activeWorktreeId ? findWorktreeById(s, s.activeWorktreeId) : null
    return worktree
      ? (s.repos.find((repo) => repo.id === worktree.repoId)?.displayName ?? null)
      : null
  })

  const handleClick = (): void => {
    if (activeWorktreeId) {
      launchPcDeskChat(activeWorktreeId)
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
