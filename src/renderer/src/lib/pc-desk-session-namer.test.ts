import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pc-desk-mode', () => ({ isPcDeskModeEnabled: () => true }))
vi.mock('@/store/github/worktree-refresh', () => ({
  findWorktreeById: (_state: unknown, id: string) =>
    id === 'wt' ? { id: 'wt', repoId: 'r', path: '/p/orca', displayName: 'orca' } : null
}))

import type { AppState } from '@/store/types'
import { notePcDeskAgentPrompt, startPcDeskSessionNamer } from './pc-desk-session-namer'

function makeStore() {
  const setPcDeskSessionTabTitle = vi.fn()
  const tab: { id: string; customTitle: null; generatedTitle: string | null } = {
    id: 'tab',
    customTitle: null,
    generatedTitle: null
  }
  const state = {
    repos: [{ id: 'r', displayName: 'orca' }],
    tabsByWorktree: { wt: [tab] },
    agentStatusByPaneKey: { 'tab:a': {} },
    setPcDeskSessionTabTitle: (tabId: string, title: string) => {
      tab.generatedTitle = title
      setPcDeskSessionTabTitle(tabId, title)
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the namer reads only the fields stubbed above.
  return { getState: () => state as unknown as AppState, setPcDeskSessionTabTitle }
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
})
