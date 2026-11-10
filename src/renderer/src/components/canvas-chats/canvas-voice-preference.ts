import { useSyncExternalStore } from 'react'

/** Fork: per-project switch for the mic that turns on by itself when a chat card opens (off = type only). */
const STORAGE_KEY = 'orca-fork.canvas-auto-voice-off'
const listeners = new Set<() => void>()
let offProjects = readStored()

function readStored(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toggleCanvasAutoVoice(projectId: string): void {
  const next = new Set(offProjects)
  if (next.has(projectId)) {
    next.delete(projectId)
  } else {
    next.add(projectId)
  }
  offProjects = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  } catch {
    // Storage blocked: the switch still works for this session.
  }
  listeners.forEach((listener) => listener())
}

export function useCanvasAutoVoice(projectId: string): boolean {
  return useSyncExternalStore(subscribe, () => !offProjects.has(projectId))
}
