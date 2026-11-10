import { useSyncExternalStore } from 'react'

/**
 * Fork: flowchart "listen mode". Ctrl+E (while the flowchart is open) turns it on until pressed again;
 * while on, every chat card that opens listens right away. Starts off on every app launch.
 */
type VoiceFinish = (mode: 'send' | 'type') => Promise<void>

const listeners = new Set<() => void>()
let listenMode = false
let activeFinisher: VoiceFinish | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCanvasListenMode(): boolean {
  return useSyncExternalStore(subscribe, () => listenMode)
}

export function toggleCanvasListenMode(): void {
  listenMode = !listenMode
  if (!listenMode) {
    // Turning it off mid-sentence keeps what was already said, typed but not sent.
    void activeFinisher?.('type')
  }
  listeners.forEach((listener) => listener())
}

/** The open card's mic registers how to wrap up, so closing the card can keep or send what was heard. */
export function setActiveCanvasVoice(finish: VoiceFinish | null): void {
  activeFinisher = finish
}

export function finishActiveCanvasVoice(mode: 'send' | 'type'): Promise<void> {
  return activeFinisher ? activeFinisher(mode) : Promise.resolve()
}
