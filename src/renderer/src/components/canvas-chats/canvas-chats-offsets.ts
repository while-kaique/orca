import { useSyncExternalStore } from 'react'
import type { CanvasBox } from './canvas-chats-layout'

/** Fork: how far the user dragged each card from its automatic spot; "Reorganizar" clears it. */
type Offsets = Readonly<Record<string, { dx: number; dy: number }>>

const STORAGE_KEY = 'orca-fork.canvas-offsets'
const listeners = new Set<() => void>()
let offsets: Offsets = readStored()

function readStored(): Offsets {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Offsets) : {}
  } catch {
    return {}
  }
}

function save(next: Offsets): void {
  offsets = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: positions still hold for this session.
  }
  listeners.forEach((listener) => listener())
}

export function useCanvasOffsets(): Offsets {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => offsets
  )
}

export function readCanvasOffsets(): Offsets {
  return offsets
}

/** Moves a group of cards (a project with its chats, or a chat with its agents) together. */
export function setCanvasOffsets(
  start: Offsets,
  keys: readonly string[],
  dx: number,
  dy: number
): void {
  const next = { ...offsets }
  for (const key of keys) {
    const base = start[key] ?? { dx: 0, dy: 0 }
    next[key] = { dx: base.dx + dx, dy: base.dy + dy }
  }
  save(next)
}

export function clearCanvasOffsets(): void {
  save({})
}

export function applyCanvasOffsets(
  boxes: Readonly<Record<string, CanvasBox>>,
  current: Offsets
): Record<string, CanvasBox> {
  const out: Record<string, CanvasBox> = {}
  for (const [key, box] of Object.entries(boxes)) {
    const offset = current[key]
    out[key] = offset ? { ...box, x: box.x + offset.dx, y: box.y + offset.dy } : box
  }
  return out
}
