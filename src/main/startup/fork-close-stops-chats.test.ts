import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '', whenReady: () => new Promise(() => {}) },
  dialog: { showMessageBox: vi.fn() }
}))
vi.mock('../daemon/daemon-provider-state', () => ({
  getDaemonProvider: () => null,
  listLiveDaemonSessions: async () => null
}))
vi.mock('./main-process-state', () => ({ mainProcessState: { store: null } }))

const loadModule = async () => import('./fork-close-stops-chats')

describe('fork close stops chats', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ORCA_FORK_FECHAR_PARA_CHATS = '1'
  })
  afterEach(() => {
    delete process.env.ORCA_FORK_FECHAR_PARA_CHATS
  })

  it('kills only the tree of this Orca daemon: the chat, the chat its parent opened, never another Orca or a reused pid', async () => {
    const { arvoreDosGuardas } = await loadModule()
    const processes = [
      { pid: 100, pai: 1, nascido: 1_000 },
      { pid: 101, pai: 100, nascido: 2_000 },
      { pid: 102, pai: 101, nascido: 2_100 },
      { pid: 103, pai: 100, nascido: 3_000 },
      { pid: 104, pai: 103, nascido: 3_100 },
      { pid: 200, pai: 1, nascido: 1_500 },
      { pid: 201, pai: 200, nascido: 2_500 },
      { pid: 300, pai: 100, nascido: 500 }
    ]
    expect(
      arvoreDosGuardas(processes, [{ pid: 100, startedAtMs: 1_000 }])
        .map((p) => p.pid)
        .sort()
    ).toEqual([100, 101, 102, 103, 104])
  })

  it('asks before a close (X, Alt+F4, menu Quit, tray Quit) but never holds a Windows shutdown', async () => {
    const { forkCloseGateHolds, markOsSessionEnding } = await loadModule()
    expect(forkCloseGateHolds()).toBe(true)
    markOsSessionEnding()
    expect(forkCloseGateHolds()).toBe(false)
  })

  it('the official Orca never asks', async () => {
    delete process.env.ORCA_FORK_FECHAR_PARA_CHATS
    const { forkCloseGateHolds } = await loadModule()
    expect(forkCloseGateHolds()).toBe(false)
  })
})
