import { useSyncExternalStore } from 'react'
import { canvasChatModelLabel } from './canvas-chat-model-label'

/** Fork: the model the user picked on the chat screen for a chat; the transcript only shows it at the next request. */
export type CanvasChatModelChoice = { value: string; at: number }

const choices = new Map<string, CanvasChatModelChoice>()
const listeners = new Set<() => void>()

export function noteCanvasChatModelChoice(tabId: string, value: string): void {
  choices.set(tabId, { value, at: Date.now() })
  listeners.forEach((listener) => listener())
}

export function useCanvasChatModelChoice(tabId: string): CanvasChatModelChoice | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => choices.get(tabId) ?? null
  )
}

/**
 * The pick wins while the transcript's model is older than it; once the transcript names a model after the
 * pick (the next request or reply) the transcript is the truth again, and a same-family id is the more exact name.
 */
export function resolveCardModel(input: {
  choice: CanvasChatModelChoice | null
  transcriptModel: string | null
  /** When the transcript's model last changed in what the card read. */
  transcriptChangedAt: number
  statusModel: string | null
}): string | null {
  const { choice, transcriptModel, transcriptChangedAt, statusModel } = input
  if (!choice) {
    return transcriptModel ?? statusModel
  }
  if (transcriptModel === null) {
    return choice.value
  }
  if (choice.at <= transcriptChangedAt) {
    return transcriptModel
  }
  const picked = canvasChatModelLabel(choice.value)
  return picked && picked.family === canvasChatModelLabel(transcriptModel)?.family
    ? transcriptModel
    : choice.value
}
