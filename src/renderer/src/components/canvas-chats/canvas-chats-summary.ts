import { useEffect, useState } from 'react'

/** Fork: Haiku's 1-2 line summary per chat, refreshed only when a new reply lands and the chat stopped working. */
type SummaryEntry = { hash: string; summary: string }

const STORAGE_KEY = 'orca-fork.canvas-chat-summaries'
const MAX_PARALLEL = 2
const MIN_TEXT = 40

const cache = new Map<string, SummaryEntry>(readStored())
const inFlight = new Set<string>()
const queue: { tabId: string; cwd: string; text: string; hash: string }[] = []
const listeners = new Set<() => void>()
let running = 0

function readStored(): [string, SummaryEntry][] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (Object.entries(JSON.parse(raw)) as [string, SummaryEntry][]) : []
  } catch {
    return []
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)))
  } catch {
    // Storage full or blocked: summaries just get recomputed next time.
  }
}

function textHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return `${text.length}:${h}`
}

function pump(): void {
  while (running < MAX_PARALLEL && queue.length > 0) {
    const job = queue.shift()!
    running++
    void window.api.repos
      .summarizeCanvasReply({ cwd: job.cwd, text: job.text })
      .then((result) => {
        if (result.kind === 'ok') {
          cache.set(job.tabId, { hash: job.hash, summary: result.summary })
          persist()
          listeners.forEach((notify) => notify())
        }
      })
      .catch(() => undefined)
      .finally(() => {
        running--
        inFlight.delete(job.tabId)
        pump()
      })
  }
}

/** Summary for the closed card; asks Haiku again only when `ready` (chat stopped) and the reply text changed. */
export function useCanvasChatSummary(
  tabId: string,
  cwd: string,
  text: string,
  ready: boolean
): string | null {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const notify = (): void => setVersion((v) => v + 1)
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
    }
  }, [])
  useEffect(() => {
    if (!ready || text.trim().length < MIN_TEXT || inFlight.has(tabId)) {
      return
    }
    const hash = textHash(text)
    if (cache.get(tabId)?.hash === hash) {
      return
    }
    inFlight.add(tabId)
    queue.push({ tabId, cwd, text, hash })
    pump()
  }, [tabId, cwd, text, ready])
  return cache.get(tabId)?.summary ?? null
}
