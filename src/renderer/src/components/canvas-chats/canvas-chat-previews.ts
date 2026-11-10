import { useEffect, useSyncExternalStore } from 'react'

/** Fork: still pictures of the chats' localhost pages and artifacts, kept across restarts. */
type Preview = { dataUrl: string; at: number }

const STORAGE_KEY = 'orca-fork.canvas-page-previews'
const MAX_KEPT = 40
// A picture older than this is retaken the next time its card is on the flowchart.
const STALE_MS = 10 * 60_000

const previews = new Map<string, Preview>(readStored())
const pending = new Set<string>()
const listeners = new Set<() => void>()

function readStored(): [string, Preview][] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (Object.entries(JSON.parse(raw)) as [string, Preview][]) : []
  } catch {
    return []
  }
}

function persist(): void {
  // Newest first, capped: pictures are ~40 KB each and local storage is small.
  const kept = [...previews.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_KEPT)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    // Storage full: pictures still show this session and are retaken next time.
  }
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Takes (or retakes) the picture; main runs one at a time, so cards fill in one by one. */
export function refreshCanvasPagePreview(url: string): void {
  if (pending.has(url)) {
    return
  }
  pending.add(url)
  void window.api.repos
    .captureCanvasPagePreview(url)
    .then((result) => {
      if (result.kind === 'ok') {
        previews.set(url, { dataUrl: result.dataUrl, at: Date.now() })
        persist()
        notify()
      }
    })
    .catch(() => undefined)
    .finally(() => pending.delete(url))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The page's picture (null until the first one exists); asks for a fresh one when missing or stale. */
export function useCanvasPagePreview(url: string): string | null {
  const preview = useSyncExternalStore(subscribe, () => previews.get(url))
  useEffect(() => {
    if (!preview || Date.now() - preview.at > STALE_MS) {
      refreshCanvasPagePreview(url)
    }
  }, [url, preview])
  return preview?.dataUrl ?? null
}
