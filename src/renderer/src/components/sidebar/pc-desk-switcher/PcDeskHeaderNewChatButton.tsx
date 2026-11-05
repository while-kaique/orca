import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Repo } from '../../../../../shared/repo-types'
import { REPO_HEADER_ACTION_BUTTON_CLASS } from '../worktree-list/rows/repo-header-action-button-class'
import {
  handleRepoHeaderActionPointerDown,
  stopRepoHeaderKeyboardToggle
} from '../worktree-list/rows/header-event-guards'
import { openPcDeskChatInRepo } from './launch-pc-desk-chat'

/** "+" on a project header (PC-desk mode): a new chat in that project, born as its own row. */
export function PcDeskHeaderNewChatButton({
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
          data-pc-desk-visible=""
          data-repo-header-action=""
          aria-label={`Novo chat em ${label}`}
          onKeyDown={stopRepoHeaderKeyboardToggle}
          onPointerDown={handleRepoHeaderActionPointerDown}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openPcDeskChatInRepo(repo)
          }}
        >
          <Plus className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        Novo chat
      </TooltipContent>
    </Tooltip>
  )
}
