import { useEffect, useSyncExternalStore } from 'react'
import type { CanvasChatModels } from '../../../../shared/canvas-chat-transcript-model'
import type { CanvasContextTokens } from '../../../../shared/canvas-context-tokens'
import type { CanvasProject } from './canvas-chats-layout'

/** Fork: tokens and model of each chat, read from its transcript while the flowchart is open. */
const REFRESH_MS = 20_000
const listeners = new Set<() => void>()
let tokensByTranscript: CanvasContextTokens = {}
let modelByTranscript: CanvasChatModels = {}
const modelChangedAt = new Map<string, number>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Keeps the counts fresh: on a timer, and right away when any chat changes state (a turn just ended). */
export function useCanvasContextTokensRefresh(projects: readonly CanvasProject[]): void {
  const key = projects
    .flatMap((project) => project.chats)
    .filter((chat) => chat.transcriptPath)
    .map((chat) => `${chat.transcriptPath}\t${chat.status}`)
    .join('\n')
  useEffect(() => {
    let alive = true
    const paths = key ? key.split('\n').map((row) => row.split('\t')[0]) : []
    const read = (): void => {
      if (paths.length === 0) {
        return
      }
      void window.api.repos
        .readCanvasChatModels(paths)
        .then((next) => {
          const merged = { ...modelByTranscript, ...next }
          if (alive && JSON.stringify(merged) !== JSON.stringify(modelByTranscript)) {
            for (const [path, model] of Object.entries(merged)) {
              if (model !== modelByTranscript[path]) {
                modelChangedAt.set(path, Date.now())
              }
            }
            modelByTranscript = merged
            listeners.forEach((listener) => listener())
          }
        })
        .catch(() => undefined)
      void window.api.repos
        .readCanvasContextTokens(paths)
        .then((next) => {
          const merged = { ...tokensByTranscript, ...next }
          if (alive && JSON.stringify(merged) !== JSON.stringify(tokensByTranscript)) {
            tokensByTranscript = merged
            listeners.forEach((listener) => listener())
          }
        })
        .catch(() => undefined)
    }
    read()
    const timer = window.setInterval(read, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [key])
}

/** Null until the chat's transcript has a reply to count. */
export function useCanvasContextTokens(transcriptPath: string | null): number | null {
  return useSyncExternalStore(subscribe, () =>
    transcriptPath ? (tokensByTranscript[transcriptPath] ?? null) : null
  )
}

/** Null until the transcript names a model; it follows a /model within one refresh. */
export function useCanvasChatTranscriptModel(transcriptPath: string | null): string | null {
  return useSyncExternalStore(subscribe, () =>
    transcriptPath ? (modelByTranscript[transcriptPath] ?? null) : null
  )
}

/** When the card first read the transcript's current model (0 while there is none). */
export function useCanvasChatTranscriptModelChangedAt(transcriptPath: string | null): number {
  return useSyncExternalStore(subscribe, () =>
    transcriptPath ? (modelChangedAt.get(transcriptPath) ?? 0) : 0
  )
}
