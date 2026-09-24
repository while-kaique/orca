import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, FolderOpen, GitBranch, Loader2, Plus } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { useAppStore } from '@/store'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { getRepoMainWorktreeId } from '../../../../../shared/worktree/id'
import { getWorktreeLabel } from '../worktree-list/rows/repo-header-worktrees-menu'
import { ensurePcDeskRepo } from './open-pc-desk-folder'
import { matchFolderName, type PcDeskSwitcherRow } from './pc-desk-switcher-rows'
import { HighlightedName, OpenDot } from './pc-desk-switcher-parts'

const EMPTY_WORKTREES: readonly Worktree[] = []
const COLLAPSED_LIMIT = 8

export function PcDeskWorktreeView({
  row,
  onBack,
  onDone
}: {
  row: PcDeskSwitcherRow
  onBack: () => void
  onDone: () => void
}): React.JSX.Element {
  const [repo, setRepo] = useState<Repo | null>(row.repo)
  const [loading, setLoading] = useState(!row.repo)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const openModal = useAppStore((s) => s.openModal)
  const worktrees = useAppStore(
    (s) => (repo ? s.worktreesByRepo[repo.id] : null) ?? EMPTY_WORKTREES
  )
  const tabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)

  useEffect(() => {
    let cancelled = false
    // Why: a folder never opened in Orca has no worktree list until it is added as a project.
    void ensurePcDeskRepo(row).then((next) => {
      if (!cancelled) {
        setRepo(next)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [row])

  const main = worktrees.find((worktree) => worktree.isMainWorktree) ?? null
  const { openLinked, otherLinked } = useMemo(() => {
    const linked = worktrees
      .filter((worktree) => !worktree.isMainWorktree && !worktree.isArchived)
      .map((worktree) => ({
        worktree,
        label: getWorktreeLabel(worktree),
        match: matchFolderName(getWorktreeLabel(worktree), query),
        isOpen: (tabsByWorktree[worktree.id]?.length ?? 0) > 0
      }))
      .filter((item) => item.match.score > 0)
      .sort((a, b) => b.match.score - a.match.score)
    return {
      openLinked: linked.filter((item) => item.isOpen),
      otherLinked: linked.filter((item) => !item.isOpen)
    }
  }, [worktrees, query, tabsByWorktree])

  const collapsed = !query && !showAll && otherLinked.length > COLLAPSED_LIMIT
  const visibleOther = collapsed ? otherLinked.slice(0, COLLAPSED_LIMIT) : otherLinked

  const activate = (worktreeId: string): void => {
    onDone()
    void activateWorktreeFromSidebar(worktreeId)
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if ((event.key === 'ArrowLeft' || event.key === 'Backspace') && !query) {
      event.preventDefault()
      onBack()
    }
  }

  return (
    <Command shouldFilter={false} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        <span className="truncate">{row.name}</span>
      </button>
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder={`Buscar entre ${openLinked.length + otherLinked.length} worktrees`}
      />
      <CommandList className="max-h-[min(360px,60vh)]">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Abrindo {row.name}…
          </div>
        ) : null}
        {!loading && !repo ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            Não deu para abrir esta pasta como projeto.
          </div>
        ) : null}
        {repo && !loading ? (
          <>
            <CommandEmpty>Nenhuma worktree com “{query}”.</CommandEmpty>
            {!query ? (
              <CommandGroup>
                <CommandItem value="__main" onSelect={() => activate(getRepoMainWorktreeId(repo))}>
                  <FolderOpen className="size-3.5" />
                  <span className="flex-1">Pasta do projeto</span>
                  {main?.branch ? (
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {main.branch.replace(/^refs\/heads\//, '')}
                    </span>
                  ) : null}
                  {main && (tabsByWorktree[main.id]?.length ?? 0) > 0 ? <OpenDot /> : null}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {openLinked.length > 0 ? (
              <CommandGroup heading="Com chat aberto">
                {openLinked.map((item) => (
                  <WorktreeItem
                    key={item.worktree.id}
                    item={item}
                    active={item.worktree.id === activeWorktreeId}
                    onSelect={activate}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {visibleOther.length > 0 ? (
              <CommandGroup heading={openLinked.length > 0 ? 'Outras worktrees' : 'Worktrees'}>
                {visibleOther.map((item) => (
                  <WorktreeItem
                    key={item.worktree.id}
                    item={item}
                    active={item.worktree.id === activeWorktreeId}
                    onSelect={activate}
                  />
                ))}
                {collapsed ? (
                  <CommandItem value="__all" onSelect={() => setShowAll(true)}>
                    <span className="text-muted-foreground">
                      Mostrar todas ({otherLinked.length})
                    </span>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}
            {!query ? (
              <CommandGroup>
                <CommandItem
                  value="__new"
                  onSelect={() => {
                    onDone()
                    openModal('new-workspace-composer', {
                      initialRepoId: repo.id,
                      telemetrySource: 'sidebar'
                    })
                  }}
                >
                  <Plus className="size-3.5" />
                  Criar worktree nova…
                </CommandItem>
              </CommandGroup>
            ) : null}
          </>
        ) : null}
      </CommandList>
    </Command>
  )
}

function WorktreeItem({
  item,
  active,
  onSelect
}: {
  item: {
    worktree: Worktree
    label: string
    match: { indexes: number[] }
    isOpen: boolean
  }
  active: boolean
  onSelect: (worktreeId: string) => void
}): React.JSX.Element {
  return (
    <CommandItem
      value={item.worktree.id}
      onSelect={() => onSelect(item.worktree.id)}
      data-current={active ? 'true' : undefined}
    >
      <GitBranch className="size-3.5" />
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
        <HighlightedName name={item.label} indexes={item.match.indexes} />
      </span>
      {item.isOpen ? <OpenDot /> : null}
    </CommandItem>
  )
}
