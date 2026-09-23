import { useSyncExternalStore } from 'react'

// Fork-only preference: the project folder is the workspace; worktrees are opt-in destinations.
const STORAGE_KEY = 'orca.fork.pcDeskMode'
const listeners = new Set<() => void>()

function readStoredValue(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = readStoredValue()

export function isPcDeskModeEnabled(): boolean {
  return enabled
}

export function setPcDeskModeEnabled(next: boolean): void {
  enabled = next
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // Storage can be unavailable in tests or locked-down profiles; keep the in-memory value.
  }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePcDeskMode(): boolean {
  return useSyncExternalStore(subscribe, isPcDeskModeEnabled, isPcDeskModeEnabled)
}
