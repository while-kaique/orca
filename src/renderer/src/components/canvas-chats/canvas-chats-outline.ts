import type { CanvasBox } from './canvas-chats-layout'

/** Half the width the tree lines are drawn with, for the outline of a project. */
const LINE_HALF_WIDTH = 1

const centerX = (b: CanvasBox): number => b.x + b.w / 2

const lineBand = (xs: readonly number[], top: number, bottom: number): CanvasBox => {
  const left = Math.min(...xs) - LINE_HALF_WIDTH
  return { x: left, y: top, w: Math.max(...xs) + LINE_HALF_WIDTH - left, h: bottom - top }
}

/**
 * The lines CanvasChatTreeLines draws from one parent to its chats, as outline boxes: a stub at the parent's center out to
 * the bar (at `bars`), then the bar and the drops to each chat.
 */
export function familyLineBoxes(
  parent: CanvasBox,
  kids: readonly CanvasBox[],
  bars: readonly number[]
): CanvasBox[] {
  const up = kids[0].y < parent.y
  const near = up ? parent.y : parent.y + parent.h
  const bar = up ? Math.min(...bars) : Math.max(...bars)
  const ends = kids.map((kid) => (up ? kid.y + kid.h : kid.y))
  const far = up ? Math.min(...ends) : Math.max(...ends)
  return [
    lineBand([centerX(parent)], Math.min(near, bar), Math.max(near, bar)),
    lineBand(
      [centerX(parent), ...kids.map(centerX)],
      Math.min(bar, far) - LINE_HALF_WIDTH,
      Math.max(bar, far) + LINE_HALF_WIDTH
    )
  ]
}

/** The same outline in fewer boxes (the fitting cost grows with their count): a box inside another goes, a line stub joins the line under it. */
export function joinStacked(boxes: readonly CanvasBox[]): CanvasBox[] {
  const inside = (a: CanvasBox, b: CanvasBox): boolean =>
    a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
  const out: CanvasBox[] = []
  for (const box of boxes) {
    if (
      box.w <= 0 ||
      box.h <= 0 ||
      boxes.some((other) => other !== box && inside(box, other) && !inside(other, box))
    ) {
      continue
    }
    const below = out.find(
      (o) =>
        Math.abs(o.x - box.x) < 0.01 &&
        Math.abs(o.w - box.w) < 0.01 &&
        o.y <= box.y + box.h &&
        box.y <= o.y + o.h
    )
    if (below) {
      const bottom = Math.max(below.y + below.h, box.y + box.h)
      below.y = Math.min(below.y, box.y)
      below.h = bottom - below.y
    } else if (!out.some((o) => inside(box, o))) {
      out.push({ ...box })
    }
  }
  return out
}
