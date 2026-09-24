import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { PcDeskHomeFolderEntry } from '../../../../../shared/pc-desk-home-folder-types'
import { normalizeRuntimePathForComparison } from '../../../../../shared/cross-platform-path'
import { isGitRepoKind } from '../../../../../shared/repo-kind'

export type PcDeskSwitcherRow = {
  key: string
  name: string
  path: string
  /** Null until the folder is added to Orca (on first pick). */
  repo: Repo | null
  isGit: boolean
  isOpen: boolean
  modifiedAt: number
  matchIndexes: number[]
}

export type PcDeskSwitcherSections = {
  open: PcDeskSwitcherRow[]
  recent: PcDeskSwitcherRow[]
  all: PcDeskSwitcherRow[]
  /** Flat, ranked list used while the user is typing. */
  results: PcDeskSwitcherRow[] | null
}

const RECENT_LIMIT = 5

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Contiguous hits beat scattered ones; a hit at a word start beats one mid-word. */
export function matchFolderName(name: string, query: string): { score: number; indexes: number[] } {
  const needle = normalizeForSearch(query).trim()
  if (!needle) {
    return { score: 1, indexes: [] }
  }
  const haystack = normalizeForSearch(name)
  const at = haystack.indexOf(needle)
  if (at !== -1) {
    const indexes = Array.from({ length: needle.length }, (_, i) => at + i)
    const wordStart = at === 0 || /[\s\-_./]/.test(haystack[at - 1] ?? '')
    return { score: at === 0 ? 4 : wordStart ? 3 : 2, indexes }
  }
  const indexes: number[] = []
  let cursor = 0
  for (let i = 0; i < haystack.length && cursor < needle.length; i++) {
    if (haystack[i] === needle[cursor]) {
      indexes.push(i)
      cursor++
    }
  }
  return cursor === needle.length ? { score: 1, indexes } : { score: 0, indexes: [] }
}

export function isRepoOpen(
  repo: Repo,
  worktreesByRepo: Record<string, Worktree[]>,
  tabsByWorktree: Record<string, readonly unknown[]>,
  activeWorktreeId: string | null
): boolean {
  const worktrees = worktreesByRepo[repo.id] ?? []
  return worktrees.some(
    (worktree) => worktree.id === activeWorktreeId || (tabsByWorktree[worktree.id]?.length ?? 0) > 0
  )
}

export function buildPcDeskSwitcherSections(args: {
  entries: readonly PcDeskHomeFolderEntry[]
  repos: readonly Repo[]
  worktreesByRepo: Record<string, Worktree[]>
  tabsByWorktree: Record<string, readonly unknown[]>
  activeWorktreeId: string | null
  query: string
}): PcDeskSwitcherSections {
  const localRepos = args.repos.filter((repo) => !repo.connectionId)
  const repoByPath = new Map(
    localRepos.map((repo) => [normalizeRuntimePathForComparison(repo.path), repo])
  )
  const isOpen = (repo: Repo | null): boolean =>
    repo !== null &&
    isRepoOpen(repo, args.worktreesByRepo, args.tabsByWorktree, args.activeWorktreeId)

  const rows: PcDeskSwitcherRow[] = []
  const seenRepoIds = new Set<string>()
  for (const entry of args.entries) {
    // Why: a linked checkout already shows up inside its parent project's worktree list.
    if (entry.gitKind === 'worktree') {
      continue
    }
    const repo = repoByPath.get(normalizeRuntimePathForComparison(entry.path)) ?? null
    if (repo) {
      seenRepoIds.add(repo.id)
    }
    rows.push({
      key: entry.path,
      name: repo?.displayName || entry.name,
      path: entry.path,
      repo,
      isGit: repo ? isGitRepoKind(repo) : entry.gitKind === 'repo',
      isOpen: isOpen(repo),
      modifiedAt: entry.modifiedAt,
      matchIndexes: []
    })
  }
  // Why: projects added from outside the home folder must stay reachable from the switcher.
  for (const repo of localRepos) {
    if (!seenRepoIds.has(repo.id)) {
      rows.push({
        key: repo.id,
        name: repo.displayName,
        path: repo.path,
        repo,
        isGit: isGitRepoKind(repo),
        isOpen: isOpen(repo),
        modifiedAt: 0,
        matchIndexes: []
      })
    }
  }

  if (args.query.trim()) {
    const results = rows
      .map((row) => ({ row, match: matchFolderName(row.name, args.query) }))
      .filter(({ match }) => match.score > 0)
      .sort((a, b) => b.match.score - a.match.score || Number(b.row.isOpen) - Number(a.row.isOpen))
      .map(({ row, match }) => ({ ...row, matchIndexes: match.indexes }))
    return { open: [], recent: [], all: [], results }
  }

  const open = rows.filter((row) => row.isOpen)
  const recent = rows
    .filter((row) => !row.isOpen && row.modifiedAt > 0)
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, RECENT_LIMIT)
  const shown = new Set([...open, ...recent].map((row) => row.key))
  const all = rows.filter((row) => !shown.has(row.key))
  return { open, recent, all, results: null }
}
