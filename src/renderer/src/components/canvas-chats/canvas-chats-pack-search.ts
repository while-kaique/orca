import { largestHole } from './canvas-chats-holes'
import {
  better,
  bestSpot,
  bestSpots,
  candidateSpots,
  shiftRects,
  union,
  zoomOf,
  type PackItem,
  type PackResult,
  type PackRules,
  type PackScreen,
  type Placed,
  type Point,
  type Rect
} from './canvas-chats-packing'

/** Up to this many projects every order is tried; above it, a beam search. */
export const PACK_EXACT_LIMIT = 6
const BEAM_WIDTH = 6
/** An arrangement with cards up to this much smaller than the best one still counts when it leaves less empty space. */
const HOLE_ZOOM_SLACK = 0.03
/** Holes closer than this, in cards, count as equal. */
const SAME_HOLE = 0.05
/** Slide passes over the projects, and how many arrangements get them. */
const SLIDE_PASSES = 3
const SLIDE_SEEDS = 3
/** Candidate places per project that are measured for their hole (the smallest drawings first). */
const SLIDE_MEASURED = 40
/** How many spots are tried for each project, by number of projects. */
const BRANCHES: Record<number, number> = { 1: 1, 2: 4, 3: 4, 4: 3, 5: 2 }

type State = {
  placed: Placed[]
  bounds: Rect
  order: string[]
  zoom: number
  aligned: number
  hole?: number
}

function extend(state: State, item: PackItem, spot: Point, screen: PackScreen): State {
  const rects = shiftRects(item.rects, spot.x, spot.y)
  const mine = spot.y + item.header.y
  const aligned =
    state.aligned + state.placed.filter((p) => Math.abs(p.y + p.item.header.y - mine) < 0.5).length
  const bounds = union(state.placed.length ? [state.bounds, ...rects] : rects)
  return {
    placed: [...state.placed, { item, x: spot.x, y: spot.y, rects }],
    bounds,
    order: [...state.order, item.id],
    zoom: zoomOf(bounds, screen),
    aligned
  }
}

const area = (s: State): number => s.bounds.w * s.bounds.h
const stateBetter = (a: State, b: State): boolean =>
  better(
    { x: 0, y: 0, zoom: a.zoom, aligned: a.aligned, area: area(a) },
    { x: 0, y: 0, zoom: b.zoom, aligned: b.aligned, area: area(b) }
  )

/** The empty space left inside the drawing, in cards, counting only places where one more card could go. */
function holeOf(state: State, rules: PackRules): number {
  state.hole ??= largestHole(
    state.placed.flatMap((p) => p.rects),
    state.bounds,
    rules
  ).cards
  return state.hole
}

const EMPTY: State = {
  placed: [],
  bounds: { x: 0, y: 0, w: 0, h: 0 },
  order: [],
  zoom: 1,
  aligned: 0
}

const alignedOf = (placed: readonly Placed[]): number => {
  let count = 0
  placed.forEach((p, i) => {
    for (let j = 0; j < i; j++) {
      if (Math.abs(p.y + p.item.header.y - (placed[j].y + placed[j].item.header.y)) < 0.5) {
        count++
      }
    }
  })
  return count
}

function withSpot(state: State, index: number, spot: Point, screen: PackScreen): State {
  const placed = state.placed.map((p, i) =>
    i === index
      ? { item: p.item, x: spot.x, y: spot.y, rects: shiftRects(p.item.rects, spot.x, spot.y) }
      : p
  )
  const bounds = union(placed.flatMap((p) => p.rects))
  return {
    placed,
    bounds,
    order: state.order,
    zoom: zoomOf(bounds, screen),
    aligned: alignedOf(placed)
  }
}

/**
 * Slides each project into the empty space of the drawing: it is taken out and put back at the place that leaves the least
 * empty space, as long as the cards stay as big as `floor` asks.
 */
function slide(start: State, floor: number, screen: PackScreen, rules: PackRules): State {
  let current = start
  for (let pass = 0; pass < SLIDE_PASSES; pass++) {
    let moved = false
    current.placed.forEach((own, index) => {
      const others = current.placed.filter((_, i) => i !== index)
      const options = candidateSpots(own.item, others, screen, rules)
        .filter((c) => c.zoom >= floor && (c.x !== own.x || c.y !== own.y))
        .sort((a, b) => a.area - b.area)
        .slice(0, SLIDE_MEASURED)
      const here = holeOf(current, rules)
      let best: State | null = null
      for (const c of options) {
        const next = withSpot(current, index, c, screen)
        if (holeOf(next, rules) < (best ? holeOf(best, rules) : here - SAME_HOLE)) {
          best = next
        }
      }
      if (best) {
        current = best
        moved = true
      }
    })
    if (!moved) {
      break
    }
  }
  return current
}

/** Among arrangements whose cards are within 3% of the biggest, the one with the least empty space; then the usual order. */
function choose(
  leaves: readonly State[],
  screen: PackScreen,
  rules: PackRules,
  seeds: number
): State {
  const top = leaves.reduce((m, s) => Math.max(m, s.zoom), 0)
  const floor = top * (1 - HOLE_ZOOM_SLACK)
  const pool = leaves.filter((s) => s.zoom >= floor)
  const first = [...pool].sort((a, b) => (stateBetter(a, b) ? -1 : stateBetter(b, a) ? 1 : 0))
  const slid = first.slice(0, seeds).map((s) => slide(s, floor, screen, rules))
  const better2 = (a: State, b: State): boolean => {
    const ha = holeOf(a, rules)
    const hb = holeOf(b, rules)
    return Math.abs(ha - hb) > SAME_HOLE ? ha < hb : stateBetter(a, b)
  }
  return [...pool, ...slid].reduce((best, s) => (better2(s, best) ? s : best))
}

function exhaustive(items: readonly PackItem[], screen: PackScreen, rules: PackRules): State {
  const leaves: State[] = []
  let top = 0
  // Fewer projects leave room to try more than the single best spot for each one.
  const branches = BRANCHES[items.length] ?? 1
  const walk = (state: State, left: readonly PackItem[]): void => {
    if (state.zoom < top * (1 - HOLE_ZOOM_SLACK)) {
      return
    }
    if (left.length === 0) {
      top = Math.max(top, state.zoom)
      leaves.push(state)
      return
    }
    left.forEach((item, i) => {
      const rest = [...left.slice(0, i), ...left.slice(i + 1)]
      for (const spot of bestSpots(item, state.placed, screen, rules, branches)) {
        walk(extend(state, item, spot, screen), rest)
      }
    })
  }
  walk(EMPTY, items)
  return choose(leaves, screen, rules, SLIDE_SEEDS)
}

function inOrder(items: readonly PackItem[], screen: PackScreen, rules: PackRules): State {
  return items.reduce(
    (state, item) => extend(state, item, bestSpot(item, state.placed, screen, rules), screen),
    EMPTY
  )
}

function beam(items: readonly PackItem[], screen: PackScreen, rules: PackRules): State {
  const heightOf = (i: PackItem): number => union(i.rects).h
  const widthOf = (i: PackItem): number => union(i.rects).w
  const seeds = [
    inOrder(
      [...items].sort((a, b) => heightOf(b) - heightOf(a)),
      screen,
      rules
    ),
    inOrder(
      [...items].sort((a, b) => widthOf(b) - widthOf(a)),
      screen,
      rules
    )
  ]
  let level: State[] = [EMPTY]
  for (let depth = 0; depth < items.length; depth++) {
    const next: State[] = []
    for (const state of level) {
      const used = new Set(state.order)
      for (const item of items) {
        if (!used.has(item.id)) {
          next.push(extend(state, item, bestSpot(item, state.placed, screen, rules), screen))
        }
      }
    }
    next.sort((a, b) => (stateBetter(a, b) ? -1 : stateBetter(b, a) ? 1 : 0))
    level = next.slice(0, BEAM_WIDTH)
  }
  return choose([...level, ...seeds], screen, rules, 2)
}

/**
 * The arrangement that makes the cards biggest on the screen; among those within 3% of it, the one with the least empty
 * space inside the drawing; then level headers, the smaller area, and the sidebar order.
 */
export function packProjects(
  items: readonly PackItem[],
  screen: PackScreen,
  rules: PackRules
): PackResult {
  if (items.length === 0) {
    return { spots: {}, bounds: { x: 0, y: 0, w: 0, h: 0 }, zoom: 1 }
  }
  const state =
    items.length <= PACK_EXACT_LIMIT ? exhaustive(items, screen, rules) : beam(items, screen, rules)
  const spots: Record<string, Point> = {}
  for (const p of state.placed) {
    spots[p.item.id] = { x: p.x, y: p.y }
  }
  return { spots, bounds: state.bounds, zoom: state.zoom }
}
