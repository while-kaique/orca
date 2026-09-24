import React, { useMemo, useState } from 'react'
import { ChevronRight, Folder, GitBranch, Loader2 } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { useAppStore } from '@/store'
import type { PcDeskHomeFolderListing } from '../../../../../shared/pc-desk-home-folder-types'
import { buildPcDeskSwitcherSections, type PcDeskSwitcherRow } from './pc-desk-switcher-rows'
import { HighlightedName, OpenDot } from './pc-desk-switcher-parts'

export function PcDeskFolderView({
  listing,
  loading,
  onPick,
  onShowWorktrees
}: {
  listing: PcDeskHomeFolderListing
  loading: boolean
  onPick: (row: PcDeskSwitcherRow) => void
  onShowWorktrees: (row: PcDeskSwitcherRow) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const tabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)

  const sections = useMemo(
    () =>
      buildPcDeskSwitcherSections({
        entries: listing.entries,
        repos,
        worktreesByRepo,
        tabsByWorktree,
        activeWorktreeId,
        query
      }),
    [listing.entries, repos, worktreesByRepo, tabsByWorktree, activeWorktreeId, query]
  )
  const rowByKey = useMemo(() => {
    const all = sections.results ?? [...sections.open, ...sections.recent, ...sections.all]
    return new Map(all.map((row) => [row.key, row]))
  }, [sections])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const input = event.target instanceof HTMLInputElement ? event.target : null
    const caretAtEnd = !input || input.selectionStart === input.value.length
    const row = rowByKey.get(selected)
    if (event.key === 'ArrowRight' && caretAtEnd && row?.isGit) {
      event.preventDefault()
      onShowWorktrees(row)
    }
  }

  const renderRow = (row: PcDeskSwitcherRow): React.JSX.Element => (
    <CommandItem key={row.key} value={row.key} onSelect={() => onPick(row)}>
      <Folder className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <HighlightedName name={row.name} indexes={row.matchIndexes} />
      </span>
      {row.isOpen ? <OpenDot /> : null}
      {row.isGit ? (
        <button
          type="button"
          aria-label={`Worktrees de ${row.name}`}
          // Why: keep the click from also selecting the row (which would open the project folder).
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onShowWorktrees(row)
          }}
          className="flex h-5 shrink-0 items-center gap-0.5 rounded-md border border-border px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <GitBranch className="size-3" />
          <ChevronRight className="size-3" />
        </button>
      ) : null}
    </CommandItem>
  )

  const groups: { heading: string; rows: PcDeskSwitcherRow[] }[] = sections.results
    ? [{ heading: '', rows: sections.results }]
    : [
        { heading: 'Abertos agora', rows: sections.open },
        { heading: 'Mexidos por último', rows: sections.recent },
        {
          heading: `Todas as pastas (${sections.all.length})`,
          rows: sections.all
        }
      ]

  return (
    <Command
      shouldFilter={false}
      value={selected}
      onValueChange={setSelected}
      onKeyDown={handleKeyDown}
    >
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Buscar pasta em Projetos"
      />
      <CommandList className="max-h-[min(400px,60vh)]">
        {loading && listing.entries.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Lendo {listing.rootPath || 'Projetos'}…
          </div>
        ) : (
          <CommandEmpty>
            {listing.error
              ? `Não deu para ler ${listing.rootPath}.`
              : `Nenhuma pasta com “${query}”.`}
          </CommandEmpty>
        )}
        {groups.map((group) =>
          group.rows.length > 0 ? (
            <CommandGroup key={group.heading || 'results'} heading={group.heading || undefined}>
              {group.rows.map(renderRow)}
            </CommandGroup>
          ) : null
        )}
      </CommandList>
      <div className="flex gap-3 border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>↑↓ andar</span>
        <span>Enter abrir pasta</span>
        <span>→ worktrees</span>
      </div>
    </Command>
  )
}
