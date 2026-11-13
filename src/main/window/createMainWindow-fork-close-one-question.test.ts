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

import { createMainWindow } from './createMainWindow'
import { resetExpectedTeardownStateForTest } from '../crash-reporting/expected-teardown-state'
import { browserWindowMock, resetMainWindowMocks } from './createMainWindow-test-harness'

type Handler = (...args: any[]) => void

function setupWindow() {
  const windowHandlers: Record<string, Handler> = {}
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
    loadURL: vi.fn(() => Promise.resolve())
  }
  browserWindowMock.mockImplementation(function () {
    return instance
  })
  return { windowHandlers, webContents }
}

describe('fork close by X asks one question', () => {
  beforeEach(() => {
    resetMainWindowMocks()
    resetExpectedTeardownStateForTest()
  })
  afterEach(() => {
    delete process.env.ORCA_FORK_FECHAR_PARA_CHATS
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
