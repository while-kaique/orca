import { stat } from 'node:fs/promises'
import { extname, isAbsolute } from 'node:path'
import { ipcMain, nativeImage } from 'electron'
import { isTrustedBrowserRenderer } from '../browser/browser-renderer-trust'

// Fork: the flowchart shows the image files a chat printed (screenshots, generated art) as thumbnails.

export type CanvasImageRequest = { path: string; size: 'thumb' | 'full' }
export type CanvasImageResult = { kind: 'ok'; dataUrl: string } | { kind: 'error'; error: string }

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
const MAX_BYTES = 25_000_000
const THUMB_WIDTH = 360
const FULL_WIDTH = 2200

export async function readCanvasImage(request: CanvasImageRequest): Promise<CanvasImageResult> {
  const { path } = request
  if (!isAbsolute(path) || !IMAGE_EXTENSIONS.has(extname(path).toLowerCase())) {
    return { kind: 'error', error: 'not an image path' }
  }
  try {
    const { size } = await stat(path)
    if (size > MAX_BYTES) {
      return { kind: 'error', error: 'too large' }
    }
  } catch {
    // The chat printed a path that is gone (temp file) or was cut by a terminal wrap.
    return { kind: 'error', error: 'missing' }
  }
  const image = nativeImage.createFromPath(path)
  if (image.isEmpty()) {
    return { kind: 'error', error: 'unreadable' }
  }
  const limit = request.size === 'thumb' ? THUMB_WIDTH : FULL_WIDTH
  const fitted = image.getSize().width > limit ? image.resize({ width: limit }) : image
  return { kind: 'ok', dataUrl: fitted.toDataURL() }
}

function isRequest(value: unknown): value is CanvasImageRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    typeof value.path === 'string' &&
    'size' in value &&
    (value.size === 'thumb' || value.size === 'full')
  )
}

export function registerCanvasImageHandler(): void {
  ipcMain.removeHandler('repos:readCanvasImage')
  ipcMain.handle('repos:readCanvasImage', (event, request: unknown): Promise<CanvasImageResult> =>
    isTrustedBrowserRenderer(event.sender) && isRequest(request)
      ? readCanvasImage(request)
      : Promise.resolve({ kind: 'error', error: 'untrusted' })
  )
}
