import { useSyncExternalStore } from 'react'
import type { CanvasBox } from './canvas-chats-layout'

/** Fork: hand-drawn cords between two chats (by tab id), saved across restarts. */
export type CanvasCord = { a: string; b: string }

const STORAGE_KEY = 'orca-fork.canvas-cords'
const listeners = new Set<() => void>()
let cords: readonly CanvasCord[] = readStored()

function readStored(): CanvasCord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CanvasCord[]) : []
  } catch {
    return []
  }
}

function save(next: readonly CanvasCord[]): void {
  cords = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: cords still work for this session.
  }
  listeners.forEach((listener) => listener())
}

const sameCord = (cord: CanvasCord, a: string, b: string): boolean =>
  (cord.a === a && cord.b === b) || (cord.a === b && cord.b === a)

export function hasCanvasCord(a: string, b: string): boolean {
  return cords.some((cord) => sameCord(cord, a, b))
}

export function addCanvasCord(a: string, b: string): void {
  if (a !== b && !hasCanvasCord(a, b)) {
    save([...cords, { a, b }])
  }
}

export function removeCanvasCord(a: string, b: string): void {
  save(cords.filter((cord) => !sameCord(cord, a, b)))
}

export function useCanvasCords(): readonly CanvasCord[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => cords
  )
}

type Point = { x: number; y: number }

/** Same routing as the approved prototype: chats on one row arc over the top, others curve side to side. */
export function cordPath(from: CanvasBox, to: CanvasBox): { d: string; mid: Point } {
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 }
  const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 }
  if (Math.abs(fc.y - tc.y) < 60) {
    const a = { x: fc.x, y: from.y }
    const b = { x: tc.x, y: to.y }
    const h = 50 + Math.min(40, Math.abs(b.x - a.x) / 25)
    return {
      d: `M${a.x} ${a.y} C${a.x} ${a.y - h} ${b.x} ${b.y - h} ${b.x} ${b.y}`,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - h * 0.75 }
    }
  }
  const [left, right] = fc.x <= tc.x ? [from, to] : [to, from]
  return sidePath(
    { x: left.x + left.w, y: left.y + left.h / 2 },
    { x: right.x, y: right.y + right.h / 2 }
  )
}

/** Curve from a card's edge to a free point (while dragging) or to another card's side. */
export function sidePath(a: Point, b: Point): { d: string; mid: Point } {
  const k = Math.max(60, Math.abs(b.x - a.x) / 2)
  const dir = b.x >= a.x ? 1 : -1
  const c1 = { x: a.x + k * dir, y: a.y }
  const c2 = { x: b.x - k * dir, y: b.y }
  return {
    d: `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`,
    mid: { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 }
  }
}
