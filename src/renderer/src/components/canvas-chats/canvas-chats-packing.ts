/**
 * Fits the projects of the flowchart together by their real outlines: each outline is a stack of rectangles, so one project
 * can enter under or beside another inside the other's bounding box. Inside a project the chats keep the `grid`; a project starts on it or one margin beside another.
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
export const shiftRects = (rects: readonly Rect[], x: number, y: number): Rect[] =>
  rects.map((r) => ({ x: r.x + x, y: r.y + y, w: r.w, h: r.h }))

export const union = (rects: readonly Rect[]): Rect => {
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

export const zoomOf = (b: Rect, screen: PackScreen): number =>
  b.w <= 0 || b.h <= 0 ? 1 : Math.min(1, screen.w / b.w, screen.h / b.h)

/** Forbidden origin heights (open intervals, merged) for an item whose origin is at column `x`. */
function forbiddenHeights(
  item: PackItem,
  x: number,
  fixed: readonly Rect[],
  rules: PackRules
): [number, number][] {
  const out: [number, number][] = []
  const own = union(item.rects)
  for (const r of fixed) {
    if (x + own.x >= r.x + r.w + rules.gapX || r.x >= x + own.x + own.w + rules.gapX) {
      continue
    }
    for (const m of item.rects) {
      if (x + m.x < r.x + r.w + rules.gapX && r.x < x + m.x + m.w + rules.gapX) {
        out.push([r.y - rules.gapY - (m.y + m.h), r.y + r.h + rules.gapY - m.y])
      }
    }
  }
  return mergeIntervals(out)
}

function mergeIntervals(out: [number, number][]): [number, number][] {
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

// Why: the order search puts the same project at the same place under many orders; its forbidden heights are reused.
const heightsCache = new WeakMap<PackItem, WeakMap<PackItem, Map<string, [number, number][]>>>()

/** forbiddenHeights against placed projects, each one's share computed once per column and place. */
function forbiddenHeightsAmong(
  item: PackItem,
  x: number,
  placed: readonly Placed[],
  rules: PackRules
): [number, number][] {
  let byOther = heightsCache.get(item)
  if (!byOther) {
    byOther = new WeakMap()
    heightsCache.set(item, byOther)
  }
  const out: [number, number][] = []
  for (const p of placed) {
    let byPlace = byOther.get(p.item)
    if (!byPlace) {
      byPlace = new Map()
      byOther.set(p.item, byPlace)
    }
    const key = `${x - p.x},${p.y},${rules.gapX},${rules.gapY}`
    let share = byPlace.get(key)
    if (!share) {
      share = forbiddenHeights(item, x, p.rects, rules)
      byPlace.set(key, share)
    }
    for (const iv of share) {
      out.push([iv[0], iv[1]])
    }
  }
  return mergeIntervals(out)
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

export type Candidate = { x: number; y: number; zoom: number; aligned: number; area: number }

export function better(a: Candidate, b: Candidate): boolean {
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

/**
 * The origins across that could matter: the grid from one item's width left of everything to one gap right of it, and
 * every place one margin beside a placed rectangle. The grid holds inside a project; between projects the margin wins.
 */
function columnsFor(
  item: PackItem,
  bounds: Rect,
  fixed: readonly Rect[],
  rules: PackRules,
  beside: boolean
): number[] {
  const own = union(item.rects)
  const from = Math.floor((bounds.x - own.x - own.w - rules.gapX) / rules.grid)
  const to = Math.ceil((bounds.x + bounds.w - own.x + rules.gapX) / rules.grid)
  const out = new Set<number>()
  for (let k = from; k <= to; k++) {
    out.add(k * rules.grid)
  }
  // Why: these many more places only pay off when one project is drawn in; the order search stays on the grid.
  for (const r of beside ? fixed : []) {
    for (const m of item.rects) {
      out.add(r.x + r.w + rules.gapX - m.x)
      out.add(r.x - rules.gapX - m.x - m.w)
    }
  }
  return [...out]
}

/** Every free origin worth trying for one more item among the ones already placed, with what each would make of the drawing. */
export function candidateSpots(
  item: PackItem,
  placed: readonly Placed[],
  screen: PackScreen,
  rules: PackRules,
  beside = false
): Candidate[] {
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
  const found: Candidate[] = []
  for (const x of columnsFor(item, bounds, fixed, rules, beside)) {
    const merged = forbiddenHeightsAmong(item, x, placed, rules)
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
      found.push({
        x,
        y,
        zoom: zoomOf(all, screen),
        aligned: headerYs.filter((h) => Math.abs(h - mine) < 0.5).length,
        area: all.w * all.h
      })
    }
  }
  return found
}

/** The best free origins for one more item among the ones already placed, best first. */
export function bestSpots(
  item: PackItem,
  placed: readonly Placed[],
  screen: PackScreen,
  rules: PackRules,
  count = 1
): Point[] {
  if (placed.length === 0) {
    return [{ x: 0, y: 0 }]
  }
  const found = candidateSpots(item, placed, screen, rules)
  found.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0))
  if (found.length) {
    return found.slice(0, count).map(({ x, y }) => ({ x, y }))
  }
  const bounds = union(placed.flatMap((p) => p.rects))
  const own = union(item.rects)
  return [{ x: 0, y: bounds.y + bounds.h + rules.gapY - own.y }]
}

export const bestSpot = (
  item: PackItem,
  placed: readonly Placed[],
  screen: PackScreen,
  rules: PackRules
): Point => bestSpots(item, placed, screen, rules)[0]

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
