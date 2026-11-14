import { CANVAS_SIZES } from './canvas-chats-layout'
import type { Rect } from './canvas-chats-packing'

/** The empty space inside the drawing, measured in card areas. */
export const CARD_AREA = CANVAS_SIZES.chat.w * CANVAS_SIZES.chat.h
/** Resolution of the measure: a hole is rounded down to whole cells of this size. */
const CELL = 40

export type HoleGaps = { gapX: number; gapY: number }

/**
 * The biggest empty rectangle inside the box of the drawing that stays at least `gapX` across and `gapY` down from every
 * outline: the place where one more card could still go. Zero gaps measure the raw empty space instead.
 */
export function largestHole(
  outlines: readonly Rect[],
  bounds: Rect,
  gaps: HoleGaps
): { area: number; cards: number; rect: Rect } {
  const cols = Math.max(1, Math.ceil(bounds.w / CELL))
  const rows = Math.max(1, Math.ceil(bounds.h / CELL))
  const blocked = new Uint8Array(cols * rows)
  for (const r of outlines) {
    const c0 = Math.max(0, Math.floor((r.x - gaps.gapX - bounds.x) / CELL))
    const c1 = Math.min(cols - 1, Math.ceil((r.x + r.w + gaps.gapX - bounds.x) / CELL) - 1)
    const r0 = Math.max(0, Math.floor((r.y - gaps.gapY - bounds.y) / CELL))
    const r1 = Math.min(rows - 1, Math.ceil((r.y + r.h + gaps.gapY - bounds.y) / CELL) - 1)
    for (let row = r0; row <= r1; row++) {
      blocked.fill(1, row * cols + c0, row * cols + c1 + 1)
    }
  }
  // Largest rectangle of free cells, row by row over a histogram of free heights.
  const heights = new Int32Array(cols)
  let best = 0
  let found = { c: 0, r: 0, w: 0, h: 0 }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      heights[col] = blocked[row * cols + col] ? 0 : heights[col] + 1
    }
    const stack: number[] = []
    for (let col = 0; col <= cols; col++) {
      const h = col === cols ? 0 : heights[col]
      while (stack.length && heights[stack.at(-1) as number] >= h) {
        const top = heights[stack.pop() as number]
        const left = stack.length ? (stack.at(-1) as number) + 1 : 0
        if (top * (col - left) > best) {
          best = top * (col - left)
          found = { c: left, r: row - top + 1, w: col - left, h: top }
        }
      }
      stack.push(col)
    }
  }
  const area = best * CELL * CELL
  const rect = {
    x: bounds.x + found.c * CELL,
    y: bounds.y + found.r * CELL,
    w: found.w * CELL,
    h: found.h * CELL
  }
  return { area, cards: area / CARD_AREA, rect }
}
