import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pc-desk-mode', () => ({ isPcDeskModeEnabled: () => true }))
vi.mock('@/store/github/worktree-refresh', () => ({
  findWorktreeById: (_state: unknown, id: string) =>
    id === 'wt' ? { id: 'wt', repoId: 'r', path: '/p/orca', displayName: 'orca' } : null
}))

import type { AppState } from '@/store/types'
import {
  notePcDeskAgentPrompt,
  pcDeskWorkspaceSessionTitle,
  startPcDeskSessionNamer
} from './pc-desk-session-namer'

function makeStore() {
  const setPcDeskSessionTabTitle = vi.fn()
  const tab: { id: string; customTitle: null; generatedTitle: string | null } = {
    id: 'tab',
    customTitle: null,
    generatedTitle: null
  }
  const tabsByWorktree: Record<
    string,
    { id: string; customTitle: null; generatedTitle: string | null }[]
  > = {
    wt: [tab]
  }
  const state = {
    repos: [{ id: 'r', displayName: 'orca' }],
    tabsByWorktree,
    agentStatusByPaneKey: { 'tab:a': {} },
    setPcDeskSessionTabTitle: (tabId: string, title: string) => {
      tab.generatedTitle = title
      setPcDeskSessionTabTitle(tabId, title)
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the namer reads only the fields stubbed above.
  return { getState: () => state as unknown as AppState, setPcDeskSessionTabTitle, tabsByWorktree }
}

const note = (getState: () => AppState, paneKey: string, prompt: string) =>
  notePcDeskAgentPrompt(getState, { paneKey, prompt, worktreeId: 'wt', tabId: 'tab' })

describe('pc-desk session namer', () => {
  const suggest = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    startPcDeskSessionNamer()
    vi.stubGlobal('window', { api: { repos: { suggestPcDeskSessionTitle: suggest } } })
    suggest.mockResolvedValue({ kind: 'rename', title: 'Botão adicionar projeto' })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    suggest.mockReset()
  })

  it('starts with the project name, then names the tab from the first prompt', async () => {
    const store = makeStore()
    note(store.getState, 'tab:a', 'arruma o botão')
    expect(store.setPcDeskSessionTabTitle).toHaveBeenNthCalledWith(1, 'tab', 'orca')
    await vi.advanceTimersByTimeAsync(0)

    expect(suggest).toHaveBeenCalledTimes(1)
    expect(suggest.mock.calls[0][0]).toMatchObject({
      currentIsPlaceholder: true,
      recentPrompts: ['arruma o botão']
    })
    expect(store.setPcDeskSessionTabTitle).toHaveBeenLastCalledWith(
      'tab',
      'Botão adicionar projeto'
    )

    // A split sibling does not steer the name while the oldest chat is open.
    note(store.getState, 'tab:b', 'outra coisa')
    // Needs 3 new prompts and the 20-minute rename gap before asking again.
    note(store.getState, 'tab:a', 'um')
    note(store.getState, 'tab:a', 'dois')
    note(store.getState, 'tab:a', 'três')
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(suggest).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(11 * 60_000)
    expect(suggest).toHaveBeenCalledTimes(2)
    expect(suggest.mock.calls[1][0].recentPrompts).toEqual(['arruma o botão', 'um', 'dois', 'três'])
  })

  it('names a folder workspace and retries a failed first name on the next tick', async () => {
    const store = makeStore()
    const folderId = 'r::C:/Users/me/Projetos::workspace:f1'
    // A fresh tab id: the namer keeps per-tab state across tests.
    store.tabsByWorktree[folderId] = [{ id: 'tab2', customTitle: null, generatedTitle: null }]
    suggest.mockResolvedValueOnce({ kind: 'error', error: 'boom' })
    notePcDeskAgentPrompt(store.getState, {
      paneKey: 'tab2:a',
      prompt: 'organiza as pastas',
      worktreeId: folderId,
      tabId: 'tab2'
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(suggest.mock.calls[0][0].cwd).toBe('C:/Users/me/Projetos')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(suggest).toHaveBeenCalledTimes(2)
    expect(store.setPcDeskSessionTabTitle).toHaveBeenLastCalledWith(
      'tab2',
      'Botão adicionar projeto'
    )
  })
})

describe('pcDeskWorkspaceSessionTitle', () => {
  it('uses the oldest named tab, preferring a manual name', () => {
    expect(
      pcDeskWorkspaceSessionTitle([
        { customTitle: null, generatedTitle: null },
        { customTitle: null, generatedTitle: 'Lote 6 vitrine' },
        { customTitle: 'Outro', generatedTitle: 'x' }
      ])
    ).toBe('Lote 6 vitrine')
    expect(pcDeskWorkspaceSessionTitle(undefined)).toBeNull()
  })
})

describe('pc-desk session namer after a restart', () => {
  it('treats a saved project-name placeholder as unnamed and names it on the next prompt', async () => {
    vi.useFakeTimers()
    startPcDeskSessionNamer()
    const suggest = vi.fn().mockResolvedValue({ kind: 'rename', title: 'Lote 6 vitrine' })
    vi.stubGlobal('window', { api: { repos: { suggestPcDeskSessionTitle: suggest } } })
    const store = makeStore()
    store.tabsByWorktree.wt = [{ id: 'tab3', customTitle: null, generatedTitle: 'orca' }]
    notePcDeskAgentPrompt(store.getState, {
      paneKey: 'tab3:a',
      prompt: 'revisa o lote 6',
      worktreeId: 'wt',
      tabId: 'tab3'
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(suggest).toHaveBeenCalledTimes(1)
    expect(suggest.mock.calls[0][0].currentIsPlaceholder).toBe(true)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
