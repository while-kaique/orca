import { useEffect, useRef, useSyncExternalStore } from 'react'

/** Fork: still pictures of the chats' localhost pages and artifacts, kept across restarts. */
type Preview = { dataUrl: string; at: number }

const STORAGE_KEY = 'orca-fork.canvas-page-previews'
const MAX_KEPT = 40
// A picture older than this is retaken the next time its card is on the flowchart.
const STALE_MS = 10 * 60_000

const previews = new Map<string, Preview>(readStored())
const pending = new Set<string>()
const retakeAfter = new Set<string>()
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
    // A picture already on its way may show the page from before the update: take one more after it.
    retakeAfter.add(url)
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
    .finally(() => {
      pending.delete(url)
      if (retakeAfter.delete(url)) {
        refreshCanvasPagePreview(url)
      }
    })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The page's picture (null until the first one exists). Retaken when missing or stale, and each time the
 * chat that owns the page finishes a turn (`turnKey` changes), since that is when artifacts get republished.
 */
export function useCanvasPagePreview(url: string, turnKey: string): string | null {
  const preview = useSyncExternalStore(subscribe, () => previews.get(url))
  useEffect(() => {
    if (!preview || Date.now() - preview.at > STALE_MS) {
      refreshCanvasPagePreview(url)
    }
  }, [url, preview])
  const seenTurn = useRef(turnKey)
  useEffect(() => {
    if (turnKey && turnKey !== seenTurn.current) {
      refreshCanvasPagePreview(url)
    }
    if (turnKey) {
      seenTurn.current = turnKey
    }
  }, [url, turnKey])
  return preview?.dataUrl ?? null
}
