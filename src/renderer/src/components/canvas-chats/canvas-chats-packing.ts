/**
 * Fits the projects of the flowchart together by their real outlines: each outline is a stack of rectangles, so one project
 * can enter under or beside another inside the other's bounding box. Every project starts on a multiple of `grid`.
 */
export type Rect = { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number }

export type PackItem = {
  id: string
  /** The outline, measured from the item's origin. */
  rects: readonly Rect[]
  /** The project card inside the outline: headers of neighbouring projects are lined up when that costs nothing. */
  header: Point
}

export type PackRules = {
  /** Origins sit on multiples of this. */
  grid: number
  /** Least empty space between the outlines of two items, across and down. */
  gapX: number
  gapY: number
}

export type PackScreen = { w: number; h: number }

export type PackResult = {
  /** Origin of every item. */
  spots: Record<string, Point>
  bounds: Rect
  /** The zoom the screen settles on (never above 1:1). */
  zoom: number
}

export type Placed = { item: PackItem; x: number; y: number; rects: Rect[] }

/** Zooms closer than this count as equal, and the tidier arrangement wins. */
const SAME_ZOOM = 0.005
/** Up to this many projects every order is tried; above it, a beam search. */
export const PACK_EXACT_LIMIT = 6
const BEAM_WIDTH = 6

export const shiftRects = (rects: readonly Rect[], x: number, y: number): Rect[] =>
  rects.map((r) => ({ x: r.x + x, y: r.y + y, w: r.w, h: r.h }))

const union = (rects: readonly Rect[]): Rect => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

const zoomOf = (b: Rect, screen: PackScreen): number =>
  b.w <= 0 || b.h <= 0 ? 1 : Math.min(1, screen.w / b.w, screen.h / b.h)

/** Forbidden origin heights (open intervals, merged) for an item whose origin is at column `x`. */
function forbiddenHeights(
  item: PackItem,
  x: number,
  fixed: readonly Rect[],
  rules: PackRules
): [number, number][] {
  const out: [number, number][] = []
  for (const r of fixed) {
    for (const m of item.rects) {
      if (x + m.x < r.x + r.w + rules.gapX && r.x < x + m.x + m.w + rules.gapX) {
        out.push([r.y - rules.gapY - (m.y + m.h), r.y + r.h + rules.gapY - m.y])
      }
    }
  }
  out.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const iv of out) {
    const last = merged.at(-1)
    if (last && iv[0] < last[1]) {
      last[1] = Math.max(last[1], iv[1])
    } else {
      merged.push([iv[0], iv[1]])
    }
  }
  return merged
}

const isFree = (y: number, merged: readonly [number, number][]): boolean =>
  !merged.some(([lo, hi]) => lo < y && y < hi)

/** True when the item at this origin comes closer than the rules allow to any fixed rectangle. */
export function touches(
  item: PackItem,
  x: number,
  y: number,
  fixed: readonly Rect[],
  rules: PackRules
): boolean {
  return !isFree(y, forbiddenHeights(item, x, fixed, rules))
}

type Candidate = { x: number; y: number; zoom: number; aligned: number; area: number }

function better(a: Candidate, b: Candidate): boolean {
  if (Math.abs(a.zoom - b.zoom) > SAME_ZOOM * Math.max(a.zoom, b.zoom)) {
    return a.zoom > b.zoom
  }
  if (a.aligned !== b.aligned) {
    return a.aligned > b.aligned
  }
  if (a.area !== b.area) {
    return a.area < b.area
  }
  // Later projects go after the earlier ones in reading order: to the right or below, not left or above.
  return a.x + a.y !== b.x + b.y ? a.x + a.y > b.x + b.y : a.y < b.y
}

/** The grid origins that could matter: from one item's width left of everything to one gap right of it. */
function columnsFor(item: PackItem, bounds: Rect, rules: PackRules): number[] {
  const own = union(item.rects)
  const from = Math.floor((bounds.x - own.x - own.w - rules.gapX) / rules.grid)
  const to = Math.ceil((bounds.x + bounds.w - own.x + rules.gapX) / rules.grid)
  const out: number[] = []
  for (let k = from; k <= to; k++) {
    out.push(k * rules.grid)
  }
  return out
}

/** The best free origin for one more item among the ones already placed, or null when `placed` is empty-handed. */
export function bestSpot(
  item: PackItem,
  placed: readonly Placed[],
  screen: PackScreen,
  rules: PackRules
): Point {
  if (placed.length === 0) {
    return { x: 0, y: 0 }
  }
  const fixed = placed.flatMap((p) => p.rects)
  const bounds = union(fixed)
  const own = union(item.rects)
  const headerYs = placed.map((p) => p.y + p.item.header.y)
  const extras = [
    0,
    ...headerYs.map((y) => y - item.header.y),
    bounds.y - own.y,
    bounds.y + bounds.h - own.y - own.h
  ]
  let best: Candidate | null = null
  for (const x of columnsFor(item, bounds, rules)) {
    const merged = forbiddenHeights(item, x, fixed, rules)
    const ys = new Set<number>(extras)
    for (const [lo, hi] of merged) {
      ys.add(lo)
      ys.add(hi)
    }
    for (const y of ys) {
      if (!isFree(y, merged)) {
        continue
      }
      const all = union([bounds, ...shiftRects(item.rects, x, y)])
      const mine = y + item.header.y
      const candidate: Candidate = {
        x,
        y,
        zoom: zoomOf(all, screen),
        aligned: headerYs.filter((h) => Math.abs(h - mine) < 0.5).length,
        area: all.w * all.h
      }
      if (!best || better(candidate, best)) {
        best = candidate
      }
    }
  }
  return best ? { x: best.x, y: best.y } : { x: 0, y: bounds.y + bounds.h + rules.gapY - own.y }
}

/** The nearest free origin for an item that came to touch something: straight down, or right on the grid; the smaller move wins. */
export function nudgeAway(
  item: PackItem,
  from: Point,
  fixed: readonly Rect[],
  rules: PackRules
): Point {
  const merged = forbiddenHeights(item, from.x, fixed, rules)
  const hit = merged.find(([lo, hi]) => lo < from.y && from.y < hi)
  const down = hit ? { x: from.x, y: hit[1] } : from
  let right = from
  for (let step = 1; step <= 400; step++) {
    const x = from.x + step * rules.grid
    if (isFree(from.y, forbiddenHeights(item, x, fixed, rules))) {
      right = { x, y: from.y }
      break
    }
  }
  const moved = (p: Point): number => Math.abs(p.x - from.x) + Math.abs(p.y - from.y)
  return right === from || moved(down) <= moved(right) ? down : right
}

type State = { placed: Placed[]; bounds: Rect; order: string[]; zoom: number; aligned: number }

function extend(state: State, item: PackItem, screen: PackScreen, rules: PackRules): State {
  const spot = bestSpot(item, state.placed, screen, rules)
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

const EMPTY: State = {
  placed: [],
  bounds: { x: 0, y: 0, w: 0, h: 0 },
  order: [],
  zoom: 1,
  aligned: 0
}

function exhaustive(items: readonly PackItem[], screen: PackScreen, rules: PackRules): State {
  let best: State | null = null
  const walk = (state: State, left: readonly PackItem[]): void => {
    if (best && state.zoom < best.zoom * (1 - SAME_ZOOM)) {
      return
    }
    if (left.length === 0) {
      if (!best || stateBetter(state, best)) {
        best = state
      }
      return
    }
    left.forEach((item, i) =>
      walk(extend(state, item, screen, rules), [...left.slice(0, i), ...left.slice(i + 1)])
    )
  }
  walk(EMPTY, items)
  return best as unknown as State
}

function inOrder(items: readonly PackItem[], screen: PackScreen, rules: PackRules): State {
  return items.reduce((state, item) => extend(state, item, screen, rules), EMPTY)
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
          next.push(extend(state, item, screen, rules))
        }
      }
    }
    next.sort((a, b) => (stateBetter(a, b) ? -1 : stateBetter(b, a) ? 1 : 0))
    level = next.slice(0, BEAM_WIDTH)
  }
  return [...level, ...seeds].reduce((best, s) => (stateBetter(s, best) ? s : best))
}

/** The arrangement that makes the cards biggest on the screen; ties go to level headers, then the smaller area, then the sidebar order. */
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
