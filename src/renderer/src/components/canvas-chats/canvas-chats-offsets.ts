import { useMemo, useSyncExternalStore } from 'react'
import { isFreeChat, type CanvasBox, type CanvasProject } from './canvas-chats-layout'

/**
 * Fork: how far the user dragged each card from its automatic spot; "Reorganizar" clears it. `zone` is where a
 * chat sat when dragged on its own (above the project as free, or in the hierarchy below it): a chat that
 * changed zone since (a PO the hierarchy just recognized) goes back to its automatic spot instead of being
 * pushed by a drag measured from another place.
 */
export type CanvasZone = 'free' | 'tree'
type Offsets = Readonly<Record<string, { dx: number; dy: number; zone?: CanvasZone }>>

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

export function applyCanvasOffsets(
  boxes: Readonly<Record<string, CanvasBox>>,
  current: Offsets,
  zones?: ReadonlyMap<string, CanvasZone>
): Record<string, CanvasBox> {
  const out: Record<string, CanvasBox> = {}
  for (const [key, box] of Object.entries(boxes)) {
    const stored = current[key]
    const now = zones?.get(key)
    const offset = stored?.zone && now && stored.zone !== now ? undefined : stored
    out[key] = offset ? { ...box, x: box.x + offset.dx, y: box.y + offset.dy } : box
  }
  return out
}

/** Where each card is drawn: its automatic spot plus what the user dragged, and which side of its project each chat is on. */
export function useCanvasPlacement(
  autoBoxes: Readonly<Record<string, CanvasBox>>,
  projects: readonly CanvasProject[]
): { boxes: Record<string, CanvasBox>; zones: ReadonlyMap<string, CanvasZone> } {
  const current = useCanvasOffsets()
  const zones = useMemo(
    () =>
      new Map(
        projects.flatMap((project) =>
          project.chats.map((chat): [string, CanvasZone] => [
            chat.key,
            isFreeChat(chat) ? 'free' : 'tree'
          ])
        )
      ),
    [projects]
  )
  const boxes = useMemo(
    () => applyCanvasOffsets(autoBoxes, current, zones),
    [autoBoxes, current, zones]
  )
  return { boxes, zones }
}
