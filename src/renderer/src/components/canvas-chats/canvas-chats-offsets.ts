import { useSyncExternalStore } from 'react'
import type { CanvasBox } from './canvas-chats-layout'

/**
 * Fork: how far the user dragged each card from its automatic spot; "Reorganizar" clears it. `zone` is where a
 * chat sat when dragged on its own (above the project as free, or in the hierarchy below it): a chat that
 * changed zone since (a PO the hierarchy just recognized) goes back to its automatic spot instead of being
 * pushed by a drag measured from another place.
 */
export type CanvasZone = 'free' | 'tree'
export type CanvasOffsets = Readonly<Record<string, { dx: number; dy: number; zone?: CanvasZone }>>

const STORAGE_KEY = 'orca-fork.canvas-offsets'
const listeners = new Set<() => void>()
let offsets: CanvasOffsets = readStored()

function readStored(): CanvasOffsets {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CanvasOffsets) : {}
  } catch {
    return {}
  }
}

function save(next: CanvasOffsets): void {
  offsets = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: positions still hold for this session.
  }
  listeners.forEach((listener) => listener())
}

export function useCanvasOffsets(): CanvasOffsets {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => offsets
  )
}

export function readCanvasOffsets(): CanvasOffsets {
  return offsets
}

/** Moves a group of cards (a project with its chats, or a chat with its agents) together. */
export function setCanvasOffsets(
  start: CanvasOffsets,
  keys: readonly string[],
  dx: number,
  dy: number,
  zones?: ReadonlyMap<string, CanvasZone>
): void {
  const next = { ...offsets }
  for (const key of keys) {
    const base = start[key] ?? { dx: 0, dy: 0 }
    const zone = zones?.get(key) ?? base.zone
    next[key] = { dx: base.dx + dx, dy: base.dy + dy, ...(zone ? { zone } : {}) }
  }
  save(next)
}

export function clearCanvasOffsets(): void {
  save({})
}

export function setAllCanvasOffsets(next: CanvasOffsets): void {
  save(next)
}

/** What the user dragged a card by, unless the card changed zone since (then it is back at its automatic spot). */
export function effectiveOffset(
  key: string,
  current: CanvasOffsets,
  zones?: ReadonlyMap<string, CanvasZone>
): { dx: number; dy: number } | undefined {
  const stored = current[key]
  const now = zones?.get(key)
  return stored?.zone && now && stored.zone !== now ? undefined : stored
}

type PlacementRules = {
  /** The chat each chat hangs from: a chat with no drag of its own moves with the one that created it. */
  parents?: ReadonlyMap<string, string>
  /** Project cards sit where their anchor says; a drag offset stored for one is ignored. */
  skipProjects?: boolean
}

export function applyCanvasOffsets(
  boxes: Readonly<Record<string, CanvasBox>>,
  current: CanvasOffsets,
  zones?: ReadonlyMap<string, CanvasZone>,
  rules: PlacementRules = {}
): Record<string, CanvasBox> {
  const out: Record<string, CanvasBox> = {}
  const resolve = (key: string, depth = 0): { dx: number; dy: number } | undefined => {
    const own = effectiveOffset(key, current, zones)
    const parent = rules.parents?.get(key)
    return own ?? (parent && depth < 60 ? resolve(parent, depth + 1) : undefined)
  }
  for (const [key, box] of Object.entries(boxes)) {
    const offset = rules.skipProjects && key.startsWith('project:') ? undefined : resolve(key)
    out[key] = offset ? { ...box, x: box.x + offset.dx, y: box.y + offset.dy } : box
  }
  return out
}
