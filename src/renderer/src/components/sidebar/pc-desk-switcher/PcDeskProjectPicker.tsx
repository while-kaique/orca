import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePcDeskHomeFolders } from './use-pc-desk-home-folders'
import { openPcDeskChatInFolder } from './launch-pc-desk-chat'
import { createPcDeskProject } from './create-pc-desk-project'
import { PcDeskFolderView } from './PcDeskFolderView'
import { PcDeskWorktreeView } from './PcDeskWorktreeView'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'

type View = { kind: 'folders' } | { kind: 'worktrees'; row: PcDeskSwitcherRow }

/**
 * Project search popover shared by the sidebar "+" and the flowchart's add button: pick a Projetos
 * folder to open a new chat in it, or type a new name to create the project.
 */
export function PcDeskProjectPicker({
  trigger,
  side = 'top',
  align = 'start',
  onChatOpened
}: {
  trigger: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** Runs once the new chat exists (opening it activates the workspace, which leaves other views). */
  onChatOpened?: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>({ kind: 'folders' })
  const { listing, loading } = usePcDeskHomeFolders(open)

  const handleOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next) {
      setView({ kind: 'folders' })
    }
  }
  const close = (): void => handleOpenChange(false)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-[min(340px,calc(100vw-1rem))] min-w-[var(--radix-popover-trigger-width)]"
      >
        {view.kind === 'folders' ? (
          <PcDeskFolderView
            listing={listing}
            loading={loading}
            placeholder="Nome do projeto"
            onPick={(row) => {
              close()
              void openPcDeskChatInFolder(row).then(onChatOpened)
            }}
            onShowWorktrees={(row) => setView({ kind: 'worktrees', row })}
            onCreate={(name) => {
              close()
              void createPcDeskProject(listing.rootPath, name).then((created) => {
                if (created) {
                  onChatOpened?.()
                }
              })
            }}
          />
        ) : (
          <PcDeskWorktreeView
            row={view.row}
            onBack={() => setView({ kind: 'folders' })}
            onDone={close}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
