import { useEffect, useSyncExternalStore } from 'react'
import type { CanvasContextTokens } from '../../../../shared/canvas-context-tokens'
import type { CanvasProject } from './canvas-chats-layout'

/** Fork: tokens in each chat's context, read from its transcript while the flowchart is open. */
const REFRESH_MS = 20_000
const listeners = new Set<() => void>()
let tokensByTranscript: CanvasContextTokens = {}

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
