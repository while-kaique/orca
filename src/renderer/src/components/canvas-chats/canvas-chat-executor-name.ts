import { useEffect, useSyncExternalStore } from 'react'
import type { CanvasChat } from './canvas-chats-layout'

/** Fork: Haiku's short job title per executor (two words) or planner (four) chat, asked once and kept. */
const STORAGE_KEY = 'orca-fork.canvas-executor-names'
const WORD_LIMIT = { executor: 2, planejador: 4 } as const
// Why: names used to be cut at these lengths mid-word; a stored name this long is asked again.
const OLD_CUT_LENGTH = { executor: 24, planejador: 40 } as const
type NamedRole = keyof typeof WORD_LIMIT
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

/** At most the role's count of words that carry meaning ("Criador de Testes" keeps its connector). */
export function executorTitle(raw: string, role: NamedRole = 'executor'): string {
  const kept: string[] = []
  let meaningful = 0
  for (const word of raw.trim().split(/\s+/u)) {
    if (!word) {
      continue
    }
    const connector = CONNECTORS.has(word.toLowerCase())
    if (!connector && meaningful === WORD_LIMIT[role]) {
      break
    }
    kept.push(word)
    meaningful += connector ? 0 : 1
  }
  while (kept.length > 0 && CONNECTORS.has(kept.at(-1)!.toLowerCase())) {
    kept.pop()
  }
  return kept.join(' ')
}

/** The executor's or planner's title for its card; its chat title until Haiku answers. */
export function useCanvasExecutorName(chat: CanvasChat, firstPrompt: string): string {
  const order = [chat.hierarchy?.order?.title, firstPrompt].filter(Boolean).join('\n')
  const role = chat.hierarchy?.role === 'planejador' ? 'planejador' : 'executor'
  const stored = useSyncExternalStore(subscribe, () => names[chat.tabId] ?? null)
  const name = stored !== null && stored.length === OLD_CUT_LENGTH[role] ? null : stored
  const named = chat.hierarchy?.role === 'executor' || chat.hierarchy?.role === 'planejador'
  const wanted = named && name === null && order.trim() !== ''
  useEffect(() => {
    if (!wanted || asked.has(chat.tabId)) {
      return
    }
    asked.add(chat.tabId)
    void window.api.repos
      .nameCanvasExecutor({ cwd: chat.cwd, text: order, role })
      .then((result) => {
        const title = result.kind === 'ok' ? executorTitle(result.summary, role) : ''
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
  }, [wanted, chat.tabId, chat.cwd, order, role])
  return name ?? executorTitle(chat.title, role)
}
