import React from 'react'
import { FolderOpen, GitBranch, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getRepoMainWorktreeId } from '../../../../../../shared/worktree/id'
import {
  handleRepoHeaderActionPointerDown,
  stopRepoHeaderKeyboardToggle,
  stopRepoHeaderMenuEvent
} from './header-event-guards'

const EMPTY_WORKTREES: readonly Worktree[] = []

function getLinkedWorktrees(worktrees: readonly Worktree[]): Worktree[] {
  return worktrees.filter((worktree) => !worktree.isMainWorktree && !worktree.isArchived)
}

export function getWorktreeLabel(worktree: Worktree): string {
  return worktree.displayName || worktree.branch.replace(/^refs\/heads\//, '') || worktree.path
}

export function activateProjectFolder(repo: Pick<Repo, 'id' | 'path'>): void {
  void activateWorktreeFromSidebar(getRepoMainWorktreeId(repo))
}

/** PC-desk mode: lists a git project's linked worktrees so one can be entered on demand. */
export function RepoHeaderWorktreesMenu({
  repo,
  label,
  onCreateForRepo
}: {
  repo: Repo
  label: string
  onCreateForRepo: (projectId: string) => void
}): React.JSX.Element {
  const worktrees = useAppStore((state) => state.worktreesByRepo[repo.id] ?? EMPTY_WORKTREES)
  const linked = getLinkedWorktrees(worktrees)
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              // Why always visible (unlike the hover-revealed … and +): the count is the point.
              className="shrink-0"
              data-repo-header-action=""
              aria-label={`Worktrees de ${label}`}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={stopRepoHeaderKeyboardToggle}
              onPointerDown={handleRepoHeaderActionPointerDown}
            >
              <GitBranch className="size-3" />
              {linked.length > 0 ? <span className="text-[11px]">{linked.length}</span> : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Worktrees
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        // Why: Radix portals keep React bubbling through the project header; block menu events from arming row drag/collapse.
        onPointerDown={stopRepoHeaderMenuEvent}
        onMouseDown={stopRepoHeaderMenuEvent}
        onPointerUp={stopRepoHeaderMenuEvent}
        onMouseUp={stopRepoHeaderMenuEvent}
        onClick={stopRepoHeaderMenuEvent}
        onKeyDown={stopRepoHeaderMenuEvent}
      >
        <DropdownMenuItem onSelect={() => activateProjectFolder(repo)}>
          <FolderOpen className="size-3.5" />
          Pasta do projeto
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {linked.length > 0 ? 'Worktrees ativas' : 'Nenhuma worktree ativa'}
        </DropdownMenuLabel>
        {linked.map((worktree) => (
          <DropdownMenuItem
            key={worktree.id}
            onSelect={() => void activateWorktreeFromSidebar(worktree.id)}
          >
            <GitBranch className="size-3.5" />
            <span className="max-w-56 truncate">{getWorktreeLabel(worktree)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onCreateForRepo(repo.id)}>
          <Plus className="size-3.5" />
          Criar worktree nova…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
