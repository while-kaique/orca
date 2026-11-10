import { BrowserWindow, ipcMain } from 'electron'
import { browserSessionRegistry } from '../../browser/sessions/browser-session-registry'
import { isTrustedBrowserRenderer } from '../browser/browser-renderer-trust'

// Fork: a still picture of a chat's localhost page or claude.ai artifact, for its flowchart card.
export type CanvasPagePreviewResult =
  | { kind: 'ok'; dataUrl: string }
  | { kind: 'error'; error: string }

const VIEW_W = 1280
const VIEW_H = 800
const THUMB_W = 640
const LOAD_TIMEOUT_MS = 20_000
// Artifacts and dev pages draw after load (client-side render, web fonts): wait before the picture.
const SETTLE_MS = 2500

/** Only what the flowchart shows: local dev servers and claude.ai artifact pages. */
function previewAllowed(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.protocol === 'http:' || url.protocol === 'https:'
    }
    return (
      url.protocol === 'https:' &&
      url.hostname === 'claude.ai' &&
      /^\/(?:code\/)?artifact\//u.test(url.pathname)
    )
  } catch {
    return false
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function capture(url: string): Promise<CanvasPagePreviewResult> {
  // Same profile as the card's mini browser, so a claude.ai login imported there shows here too.
  const partition = browserSessionRegistry.resolvePartition(null) ?? undefined
  const win = new BrowserWindow({
    show: false,
    width: VIEW_W,
    height: VIEW_H,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      offscreen: true,
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  try {
    const contents = win.webContents
    contents.setAudioMuted(true)
    contents.setFrameRate(5)
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    const stopped = new Promise<void>((resolve) =>
      contents.once('did-stop-loading', () => resolve())
    )
    // Redirects (e.g. to a login page) reject loadURL even though a page still loads.
    void win.loadURL(url).catch(() => undefined)
    await Promise.race([stopped, sleep(LOAD_TIMEOUT_MS)])
    if (contents.getURL().startsWith('chrome-error:')) {
      return { kind: 'error', error: 'page did not load' }
    }
    await sleep(SETTLE_MS)
    const image = await contents.capturePage()
    if (image.isEmpty()) {
      return { kind: 'error', error: 'empty capture' }
    }
    const thumb = image.resize({ width: THUMB_W, quality: 'good' })
    return { kind: 'ok', dataUrl: `data:image/jpeg;base64,${thumb.toJPEG(72).toString('base64')}` }
  } catch (error) {
    return { kind: 'error', error: error instanceof Error ? error.message : String(error) }
  } finally {
    win.destroy()
  }
}

// One capture at a time: each one is a whole hidden page.
let queue: Promise<unknown> = Promise.resolve()

export function captureCanvasPagePreview(url: string): Promise<CanvasPagePreviewResult> {
  if (!previewAllowed(url)) {
    return Promise.resolve({ kind: 'error', error: 'url not allowed' })
  }
  const run = queue.then(() => capture(url))
  queue = run.catch(() => undefined)
  return run
}

export function registerCanvasPagePreviewHandler(): void {
  ipcMain.removeHandler('repos:captureCanvasPagePreview')
  ipcMain.handle(
    'repos:captureCanvasPagePreview',
    (event, url: unknown): Promise<CanvasPagePreviewResult> =>
      isTrustedBrowserRenderer(event.sender) && typeof url === 'string'
        ? captureCanvasPagePreview(url)
        : Promise.resolve({ kind: 'error', error: 'untrusted' })
  )
}
