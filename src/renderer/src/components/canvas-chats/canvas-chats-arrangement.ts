import {
  PACK_RULES,
  planBlocks,
  type BlockPlan,
  type CanvasBox,
  type CanvasProject
} from './canvas-chats-layout'
import { packProjects, type PackItem } from './canvas-chats-packing'

/** What each plan asks of the packer: its shape, and where its header sits inside it. */
export const packItemOf = ({ block, shape, header }: BlockPlan): PackItem => ({
  id: block.project.id,
  rects: shape,
  header: { x: header.x, y: header.y }
})

export type CanvasInsets = {
  /** Screen space kept free at the bottom (the legend and the buttons). */
  bottom: number
  /** Screen space kept free on every side of the drawing. */
  pad: number
}

export const DEFAULT_CANVAS_INSETS: CanvasInsets = { bottom: 0, pad: 32 }

export type CanvasLayout = {
  boxes: Record<string, CanvasBox>
  /** Where each project card sits: the project's anchor. */
  headers: Record<string, { x: number; y: number }>
}

/** Where a plan sits when its header is at (x, y). */
export function placePlan(
  plan: BlockPlan,
  header: { x: number; y: number }
): Record<string, CanvasBox> {
  const dx = header.x - plan.header.x
  const dy = header.y - plan.header.y
  const out: Record<string, CanvasBox> = {}
  for (const [key, box] of Object.entries(plan.local)) {
    out[key] = { ...box, x: box.x + dx, y: box.y + dy }
  }
  return out
}

/** The screen the packer plans for: before it is measured, a common one so the first picture is already sensible. */
export const packScreen = (
  viewport: { w: number; h: number },
  insets: CanvasInsets
): { w: number; h: number } => {
  const view = viewport.w > 0 && viewport.h > 0 ? viewport : { w: 1600, h: 900 }
  return { w: view.w - 2 * insets.pad, h: view.h - insets.bottom - 2 * insets.pad }
}

/**
 * Project in the middle: hierarchy chats below it (each chat's own chats under it, agents under each chat), free chats side by
 * side above it. The projects are fitted together by their real outlines so the cards come out as big as the screen allows.
 */
export function layoutCanvas(
  projects: readonly CanvasProject[],
  viewport: { w: number; h: number },
  insets: CanvasInsets = DEFAULT_CANVAS_INSETS
): CanvasLayout {
  const plans = planBlocks(projects)
  const boxes: Record<string, CanvasBox> = {}
  const headers: Record<string, { x: number; y: number }> = {}
  if (plans.length === 0) {
    return { boxes, headers }
  }
  const packed = packProjects(plans.map(packItemOf), packScreen(viewport, insets), PACK_RULES)
  for (const plan of plans) {
    const origin = packed.spots[plan.block.project.id]
    const header = { x: origin.x + plan.header.x, y: origin.y + plan.header.y }
    headers[plan.block.project.id] = header
    Object.assign(boxes, placePlan(plan, header))
  }
  return { boxes, headers }
}
