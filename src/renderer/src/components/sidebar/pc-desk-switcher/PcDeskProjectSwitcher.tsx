import React, { useState } from 'react'
import { ChevronsUpDown, Folder, GitBranch } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { getWorktreeLabel } from '../worktree-list/rows/repo-header-worktrees-menu'
import { usePcDeskHomeFolders } from './use-pc-desk-home-folders'
import { openPcDeskFolder } from './open-pc-desk-folder'
import type { PcDeskSwitcherRow } from './pc-desk-switcher-rows'
import { PcDeskFolderView } from './PcDeskFolderView'
import { PcDeskWorktreeView } from './PcDeskWorktreeView'

type SwitcherView = { kind: 'folders' } | { kind: 'worktrees'; row: PcDeskSwitcherRow }

/** PC-desk mode: the box at the top of the sidebar that jumps to any folder in Desktop\Projetos. */
export function PcDeskProjectSwitcher(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SwitcherView>({ kind: 'folders' })
  const { listing, loading } = usePcDeskHomeFolders(open)
  const active = useAppStore(
    useShallow((s) => {
      const worktree = s.activeWorktreeId ? findWorktreeById(s, s.activeWorktreeId) : null
      const repo = worktree ? s.repos.find((candidate) => candidate.id === worktree.repoId) : null
      return {
        name: repo?.displayName ?? null,
        worktreeLabel: worktree && !worktree.isMainWorktree ? getWorktreeLabel(worktree) : null
      }
    })
  )

  const handleOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next) {
      setView({ kind: 'folders' })
    }
  }
  const close = (): void => handleOpenChange(false)

  return (
    <div className="px-2 pb-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background/40 px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Folder className="size-3.5" />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-[13px] font-medium">{active.name ?? 'Projetos'}</span>
              <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                {active.worktreeLabel ? (
                  <>
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate font-mono">{active.worktreeLabel}</span>
                  </>
                ) : (
                  <span className="truncate">
                    {active.name ? 'Projetos · pasta do projeto' : 'Escolha uma pasta'}
                  </span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[min(340px,calc(100vw-1rem))] min-w-[var(--radix-popover-trigger-width)]"
        >
          {view.kind === 'folders' ? (
            <PcDeskFolderView
              listing={listing}
              loading={loading}
              onPick={(row) => {
                close()
                void openPcDeskFolder(row)
              }}
              onShowWorktrees={(row) => setView({ kind: 'worktrees', row })}
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
