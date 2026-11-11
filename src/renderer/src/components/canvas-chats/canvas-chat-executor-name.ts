import { useEffect, useSyncExternalStore } from 'react'
import type { CanvasChat } from './canvas-chats-layout'

/** Fork: Haiku's one or two word job title per executor chat, asked once and kept. */
const STORAGE_KEY = 'orca-fork.canvas-executor-names'
const MAX_LENGTH = 24
const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

const listeners = new Set<() => void>()
const asked = new Set<string>()
let names: Record<string, string> = readStored()

function readStored(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    const stored: Record<string, string> = {}
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          stored[key] = value
        }
      }
    }
    return stored
  } catch {
    return {}
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** At most two words that carry meaning ("Criador de Testes" keeps its connector). */
export function executorTitle(raw: string): string {
  const kept: string[] = []
  let meaningful = 0
  for (const word of raw.trim().split(/\s+/u)) {
    if (!word) {
      continue
    }
    const connector = CONNECTORS.has(word.toLowerCase())
    if (!connector && meaningful === 2) {
      break
    }
    kept.push(word)
    meaningful += connector ? 0 : 1
  }
  while (kept.length > 0 && CONNECTORS.has(kept.at(-1)!.toLowerCase())) {
    kept.pop()
  }
  return kept.join(' ').slice(0, MAX_LENGTH).trim()
}

/** The executor's title for its round card; its chat title until Haiku answers. */
export function useCanvasExecutorName(chat: CanvasChat, firstPrompt: string): string {
  const order = [chat.hierarchy?.order?.title, firstPrompt].filter(Boolean).join('\n')
  const name = useSyncExternalStore(subscribe, () => names[chat.tabId] ?? null)
  const wanted = chat.hierarchy?.role === 'executor' && name === null && order.trim() !== ''
  useEffect(() => {
    if (!wanted || asked.has(chat.tabId)) {
      return
    }
    asked.add(chat.tabId)
    void window.api.repos
      .nameCanvasExecutor({ cwd: chat.cwd, text: order })
      .then((result) => {
        const title = result.kind === 'ok' ? executorTitle(result.summary) : ''
        if (!title) {
          return
        }
        names = { ...names, [chat.tabId]: title }
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
        } catch {
          // Storage full or blocked: the title is asked again next session.
        }
        listeners.forEach((listener) => listener())
      })
      .catch(() => undefined)
  }, [wanted, chat.tabId, chat.cwd, order])
  return name ?? executorTitle(chat.title)
}
