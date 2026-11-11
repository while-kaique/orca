import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePcDeskHomeFolders } from './use-pc-desk-home-folders'
import { openPcDeskChatInFolder, type PcDeskChatMode } from './launch-pc-desk-chat'
import { createPcDeskProject } from './create-pc-desk-project'
import { PcDeskFolderView } from './PcDeskFolderView'
import { PcDeskWorktreeView } from './PcDeskWorktreeView'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'

type View = { kind: 'folders' } | { kind: 'worktrees'; row: PcDeskSwitcherRow }

const MODE_KEY = 'orca.pcDesk.chatMode'

function readMode(): PcDeskChatMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'livre' ? 'livre' : 'hierarquico'
  } catch {
    return 'hierarquico'
  }
}

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
  const [mode, setMode] = useState<PcDeskChatMode>(readMode)
  const { listing, loading } = usePcDeskHomeFolders(open)
  const pickMode = (next: string): void => {
    if (next !== 'hierarquico' && next !== 'livre') {
      return
    }
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // Private storage: the choice just lasts until the popover remounts.
    }
  }

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
          <ToggleGroup
            type="single"
            size="sm"
            value={mode}
            onValueChange={pickMode}
            className="mb-1.5 w-full rounded-md bg-muted p-0.5"
          >
            <ToggleGroupItem
              value="hierarquico"
              className="flex-1 text-xs text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs"
              title="Abre o PO do projeto no Fable, esperando o seu briefing"
            >
              Hierárquico (PO)
            </ToggleGroupItem>
            <ToggleGroupItem
              value="livre"
              className="flex-1 text-xs text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs"
              title="Chat solto, sem hierarquia, como era antes"
            >
              Livre
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        {view.kind === 'folders' ? (
          <PcDeskFolderView
            listing={listing}
            loading={loading}
            placeholder="Nome do projeto"
            onPick={(row) => {
              close()
              void openPcDeskChatInFolder(row, mode).then(onChatOpened)
            }}
            onShowWorktrees={(row) => setView({ kind: 'worktrees', row })}
            onCreate={(name) => {
              close()
              void createPcDeskProject(listing.rootPath, name, mode).then((created) => {
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
