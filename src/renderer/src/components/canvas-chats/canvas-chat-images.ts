import { useEffect, useSyncExternalStore } from 'react'

/** Fork: thumbnails (and, on demand, full pictures) of the image files a chat printed. */
type Size = 'thumb' | 'full'

const pictures = new Map<string, string | null>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function load(path: string, size: Size): void {
  const key = `${size}:${path}`
  if (pictures.has(key) || pending.has(key)) {
    return
  }
  pending.add(key)
  void window.api.repos
    .readCanvasImage({ path, size })
    .then((result) => pictures.set(key, result.kind === 'ok' ? result.dataUrl : null))
    .catch(() => pictures.set(key, null))
    .finally(() => {
      pending.delete(key)
      listeners.forEach((listener) => listener())
    })
}

/** The picture as a data URL; undefined while it loads, null when the file is gone or unreadable. */
export function useCanvasImage(path: string, size: Size): string | null | undefined {
  const picture = useSyncExternalStore(subscribe, () => pictures.get(`${size}:${path}`))
  useEffect(() => load(path, size), [path, size])
  return picture
}
