import {
  CANVAS_SIZES,
  COLUMN_GAP,
  planBlocks,
  type BlockPlan,
  type CanvasBox,
  type CanvasProject
} from './canvas-chats-layout'

// The placement rule before the outline fitting: rows of equal count, the squarer grid wins within 15% of zoom.
// Kept only to convert what users had saved: cards dragged under it were measured from these spots.
const PROJECT_GAP = CANVAS_SIZES.chat.w + 2 * COLUMN_GAP
const HEADER_OVERHANG = CANVAS_SIZES.project.w - CANVAS_SIZES.chat.w
const ROW_GAP = PROJECT_GAP - HEADER_OVERHANG
const SQUARE_GRID_TOLERANCE = 0.85

type Spot = { plan: BlockPlan; x: number; y: number }

function stack(rows: readonly BlockPlan[][]): { spots: Spot[]; H: number } {
  const spots: Spot[] = []
  for (const row of rows) {
    let x = 0
    const above = [...spots]
    for (const plan of row) {
      const right = x + plan.block.w + HEADER_OVERHANG
      const y = Math.max(
        0,
        ...above
          .filter((s) => s.x < right && x < s.x + s.plan.block.w + HEADER_OVERHANG)
          .map((s) => s.y + s.plan.block.h + ROW_GAP)
      )
      spots.push({ plan, x, y })
      x += plan.block.w + PROJECT_GAP
    }
  }
  return { spots, H: Math.max(...spots.map((s) => s.y + s.plan.block.h)) }
}

/** Where every card sat under the old rule (before any dragging). */
export function legacyAutoBoxes(
  projects: readonly CanvasProject[],
  viewport: { w: number; h: number }
): Record<string, CanvasBox> {
  const plans = planBlocks(projects)
  const boxes: Record<string, CanvasBox> = {}
  if (plans.length === 0) {
    return boxes
  }
  const grids: { s: number; rows: BlockPlan[][]; spots: Spot[] }[] = []
  for (let r = 1; r <= plans.length; r++) {
    const per = Math.ceil(plans.length / r)
    const rows: BlockPlan[][] = []
    for (let i = 0; i < plans.length; i += per) {
      rows.push(plans.slice(i, i + per))
    }
    const W =
      Math.max(
        ...rows.map(
          (row) => row.reduce((sum, p) => sum + p.block.w, 0) + (row.length - 1) * PROJECT_GAP
        )
      ) + HEADER_OVERHANG
    const { spots, H } = stack(rows)
    const s = Math.min((viewport.w - 120) / W, (viewport.h - 120) / H)
    if (!grids.some((g) => g.rows.length === rows.length)) {
      grids.push({ s, rows, spots })
    }
  }
  const topS = Math.max(...grids.map((g) => g.s))
  const squareness = (g: (typeof grids)[number]): number =>
    Math.abs(g.rows.length - g.rows[0].length)
  const close = (g: (typeof grids)[number]): boolean =>
    g.s === topS || (topS > 0 && g.s >= topS * SQUARE_GRID_TOLERANCE)
  const best =
    grids.filter(close).sort((a, b) => squareness(a) - squareness(b) || b.s - a.s)[0] ?? grids[0]
  for (const { plan, x, y } of best.spots) {
    for (const [key, box] of Object.entries(plan.local)) {
      boxes[key] = { ...box, x: box.x + x, y: box.y + y }
    }
  }
  return boxes
}
