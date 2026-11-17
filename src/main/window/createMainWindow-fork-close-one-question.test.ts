import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () =>
  (await import('./createMainWindow-test-harness')).electronModuleMock()
)
vi.mock('./macos-tahoe-release', async () =>
  (await import('./createMainWindow-test-harness')).macosTahoeReleaseMock()
)
vi.mock('./desktop-integration/app-icon', async () =>
  (await import('./createMainWindow-test-harness')).appIconMock()
)
vi.mock('../browser/browser-manager', async () =>
  (await import('./createMainWindow-test-harness')).browserManagerMock()
)

import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ipcMain } from 'electron'
import { createMainWindow } from './createMainWindow'
import { markUserQuitWindowClose } from './user-quit-window-close'
import { resetExpectedTeardownStateForTest } from '../crash-reporting/expected-teardown-state'
import { browserWindowMock, resetMainWindowMocks } from './createMainWindow-test-harness'

type Handler = (...args: any[]) => void

function setupWindow() {
  const windowHandlers: Record<string, Handler> = {}
  const ipcHandlers: Record<string, Handler> = {}
  vi.mocked(ipcMain.on).mockImplementation((channel, handler) => {
    ipcHandlers[channel] = handler
    return ipcMain
  })
  const webContents = {
    id: 42,
    on: vi.fn((event: string, handler: Handler) => {
      windowHandlers[event] = handler
    }),
    setZoomLevel: vi.fn(),
    setBackgroundThrottling: vi.fn(),
    setWebRTCIPHandlingPolicy: vi.fn(),
    invalidate: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    send: vi.fn(),
    isCrashed: vi.fn(() => false)
  }
  const instance = {
    webContents,
    on: vi.fn((event: string, handler: Handler) => {
      windowHandlers[event] = handler
    }),
    isDestroyed: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    getSize: vi.fn(() => [1200, 800]),
    setSize: vi.fn(),
    maximize: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
    loadFile: vi.fn(() => Promise.resolve()),
    loadURL: vi.fn(() => Promise.resolve()),
    isVisible: vi.fn(() => false),
    close: vi.fn(() => windowHandlers.close({ preventDefault: vi.fn() }))
  }
  browserWindowMock.mockImplementation(function () {
    return instance
  })
  return { windowHandlers, ipcHandlers, webContents, instance }
}

describe('fork close by X asks one question', () => {
  beforeEach(() => {
    resetMainWindowMocks()
    resetExpectedTeardownStateForTest()
  })
  afterEach(() => {
    delete process.env.ORCA_FORK_FECHAR_PARA_CHATS
    delete process.env.ORCA_FORK_X_TESTE_RESPOSTA
    delete process.env.ORCA_FORK_X_TESTE_SAIDA
  })

  it('menu Quit and tray Quit (a user quit) reach the fork question once the renderer confirms', async () => {
    const saida = join(mkdtempSync(join(tmpdir(), 'fork-x-')), 'pergunta.txt')
    process.env.ORCA_FORK_FECHAR_PARA_CHATS = '1'
    process.env.ORCA_FORK_X_TESTE_RESPOSTA = 'cancelar'
    process.env.ORCA_FORK_X_TESTE_SAIDA = saida
    const { windowHandlers, ipcHandlers, instance } = setupWindow()
    createMainWindow(null, { getIsQuitting: () => true })

    markUserQuitWindowClose(instance)
    windowHandlers.close({ preventDefault: vi.fn() })
    ipcHandlers['window:confirm-close']?.()

    await vi.waitFor(() => expect(existsSync(saida)).toBe(true))
    expect(readFileSync(saida, 'utf8')).toContain('Fechar o Orca')
    expect(instance.destroy).not.toHaveBeenCalled()
  })

  it('with the fork option, the renderer is asked as on a quit, so it skips its own running-terminals question', () => {
    process.env.ORCA_FORK_FECHAR_PARA_CHATS = '1'
    const { windowHandlers, webContents } = setupWindow()
    createMainWindow(null, { getIsQuitting: () => false })

    windowHandlers.close({ preventDefault: vi.fn() })

    expect(webContents.send).toHaveBeenCalledWith('window:close-requested', {
      isQuitting: true,
      requestId: expect.any(Number)
    })
  })

  it('without the fork option, a plain X keeps the official behavior', () => {
    const { windowHandlers, webContents } = setupWindow()
    createMainWindow(null, { getIsQuitting: () => false })

    windowHandlers.close({ preventDefault: vi.fn() })

    expect(webContents.send).toHaveBeenCalledWith('window:close-requested', {
      isQuitting: false,
      requestId: expect.any(Number)
    })
  })
})
