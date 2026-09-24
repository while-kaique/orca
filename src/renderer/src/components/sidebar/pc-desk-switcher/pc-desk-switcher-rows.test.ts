import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { PcDeskHomeFolderEntry } from '../../../../../shared/pc-desk-home-folder-types'
import { buildPcDeskSwitcherSections, matchFolderName } from './pc-desk-switcher-rows'

const root = 'C:\\Users\\User\\Desktop\\Projetos'
const entry = (name: string, gitKind: PcDeskHomeFolderEntry['gitKind'], modifiedAt = 1) => ({
  name,
  path: `${root}\\${name}`,
  gitKind,
  modifiedAt
})
const repo = (id: string, name: string): Repo =>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only id/path/displayName/kind/connectionId.
  ({ id, path: `${root}\\${name}`, displayName: name, kind: 'git' }) as Repo
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only id and isMainWorktree.
const worktree = (id: string): Worktree => ({ id, isMainWorktree: true }) as Worktree

describe('matchFolderName', () => {
  it('ranks a prefix above a word start above a mid-word hit', () => {
    expect(matchFolderName('goatlas', 'goa').score).toBe(4)
    expect(matchFolderName('social-strategy', 'strat').score).toBe(3)
    expect(matchFolderName('regua', 'gua').score).toBe(2)
  })

  it('ignores accents and falls back to scattered letters', () => {
    expect(matchFolderName('Métricas Marketing', 'metricas').score).toBe(4)
    expect(matchFolderName('hit-stories', 'hsr').score).toBe(1)
    expect(matchFolderName('orca', 'xyz').score).toBe(0)
  })
})

describe('buildPcDeskSwitcherSections', () => {
  const base = {
    entries: [
      entry('orca', 'repo', 5),
      entry('mapa-de-dores', null, 9),
      entry('solta', 'worktree')
    ],
    repos: [repo('r1', 'orca')],
    worktreesByRepo: { r1: [worktree('r1::main')] },
    activeWorktreeId: null,
    query: ''
  }

  it('puts projects with open tabs first and hides loose worktree checkouts', () => {
    const sections = buildPcDeskSwitcherSections({ ...base, tabsByWorktree: { 'r1::main': [{}] } })
    expect(sections.open.map((row) => row.name)).toEqual(['orca'])
    expect(sections.recent.map((row) => row.name)).toEqual(['mapa-de-dores'])
    expect(
      [...sections.open, ...sections.recent, ...sections.all].some((row) => row.name === 'solta')
    ).toBe(false)
  })

  it('marks non-git folders and returns a flat ranked list while searching', () => {
    const sections = buildPcDeskSwitcherSections({ ...base, tabsByWorktree: {}, query: 'mapa' })
    expect(sections.results?.map((row) => [row.name, row.isGit, row.repo])).toEqual([
      ['mapa-de-dores', false, null]
    ])
  })
})
