import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { usePcDeskMode } from '@/lib/pc-desk-mode'
import type { Repo } from '../../../../../shared/repo-types'
import { REPO_HEADER_ACTION_BUTTON_CLASS } from '../repo-header-action-button-class'
import {
  handleRepoHeaderActionPointerDown,
  stopRepoHeaderKeyboardToggle
} from '../worktree-list/rows/header-event-guards'
import { closePcDeskProject, closePcDeskWorktrees } from './close-pc-desk-project'

/** True in PC-desk mode while the workspace has any tab open. */
export function usePcDeskCloseVisible(worktreeId: string): boolean {
  const pcDeskMode = usePcDeskMode()
  const hasTabs = useAppStore(
    (s) =>
      (s.unifiedTabsByWorktree[worktreeId]?.length ?? 0) > 0 ||
      (s.tabsByWorktree[worktreeId]?.length ?? 0) > 0
  )
  return pcDeskMode && hasTabs
}

/** Hover X on a project header: closes the chats of all its workspaces. */
export function PcDeskCloseProjectButton({
  repo,
  label
}: {
  repo: Repo
  label: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={REPO_HEADER_ACTION_BUTTON_CLASS}
          data-repo-header-action=""
          aria-label={`Fechar os chats de ${label}`}
          onKeyDown={stopRepoHeaderKeyboardToggle}
          onPointerDown={handleRepoHeaderActionPointerDown}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            closePcDeskProject(repo)
          }}
        >
          <X className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        Fechar os chats
      </TooltipContent>
    </Tooltip>
  )
}

/** Hover X on a workspace row: closes that workspace's chats. */
export function PcDeskCloseWorktreeButton({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-workspace-board-preserve-open=""
          aria-label="Fechar os chats desta worktree"
          // Why: a pointerdown reaching the card would activate the workspace being closed.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            closePcDeskWorktrees([worktreeId])
          }}
          className="inline-flex size-4 items-center justify-center rounded bg-transparent text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/worktree-card:opacity-100 group-focus-within/worktree-card:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        Fechar os chats
      </TooltipContent>
    </Tooltip>
  )
}
