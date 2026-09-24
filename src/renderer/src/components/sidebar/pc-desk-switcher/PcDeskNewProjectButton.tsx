import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePcDeskHomeFolders } from './use-pc-desk-home-folders'
import { openPcDeskFolder } from './open-pc-desk-folder'
import { createPcDeskProject } from './create-pc-desk-project'
import { PcDeskFolderView } from './PcDeskFolderView'
import { PcDeskWorktreeView } from './PcDeskWorktreeView'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'

type View = { kind: 'folders' } | { kind: 'worktrees'; row: PcDeskSwitcherRow }

/** PC-desk mode: fixed "+" under the open chats — search Desktop\Projetos or create a new project. */
export function PcDeskNewProjectButton(): React.JSX.Element {
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
    <div className="shrink-0 px-2 pt-1 pb-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Abrir ou criar projeto"
            aria-haspopup="dialog"
            className="flex h-8 w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-solid hover:bg-sidebar-accent hover:text-foreground data-[state=open]:border-solid data-[state=open]:bg-sidebar-accent"
          >
            <Plus className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
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
                void openPcDeskFolder(row)
              }}
              onShowWorktrees={(row) => setView({ kind: 'worktrees', row })}
              onCreate={(name) => {
                close()
                void createPcDeskProject(listing.rootPath, name)
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
    </div>
  )
}
