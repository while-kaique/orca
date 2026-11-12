import { PROJECT_TO_CHATS, type CanvasBox } from './canvas-chats-layout'

const CHILD_BUS_RISE = PROJECT_TO_CHATS / 2

/** Project bottom → chat top: down, straight across, down, with rounded corners. */
export function busPath(from: CanvasBox, to: CanvasBox): string {
  const px = from.x + from.w / 2
  const py = from.y + from.h
  const cx = to.x + to.w / 2
  const cy = to.y
  const m = (py + cy) / 2
  const dir = Math.sign(cx - px)
  const r = Math.min(12, Math.abs(cx - px) / 2, (cy - py) / 2)
  if (Math.abs(cx - px) < 1) {
    return `M${px} ${py} V${cy}`
  }
  return `M${px} ${py} V${m - r} Q${px} ${m} ${px + dir * r} ${m} H${cx - dir * r} Q${cx} ${m} ${cx} ${m + r} V${cy}`
}

/** Project top → free chat bottom: up, straight across, up, mirroring busPath. */
export function busPathUp(from: CanvasBox, to: CanvasBox): string {
  const px = from.x + from.w / 2
  const py = from.y
  const cx = to.x + to.w / 2
  const cy = to.y + to.h
  const m = (py + cy) / 2
  const dir = Math.sign(cx - px)
  const r = Math.min(12, Math.abs(cx - px) / 2, (py - cy) / 2)
  if (Math.abs(cx - px) < 1) {
    return `M${px} ${py} V${cy}`
  }
  return `M${px} ${py} V${m + r} Q${px} ${m} ${px + dir * r} ${m} H${cx - dir * r} Q${cx} ${m} ${cx} ${m - r} V${cy}`
}

/** Chat → a chat it created: out of its bottom center, across right below it, then straight down the child's own column. */
export function childChatPath(from: CanvasBox, to: CanvasBox): string {
  const sx = from.x + from.w / 2
  const sy = from.y + from.h
  const cx = to.x + to.w / 2
  const cy = to.y
  const m = sy + CHILD_BUS_RISE
  if (Math.abs(cx - sx) < 1) {
    return `M${sx} ${sy} V${cy}`
  }
  const dir = Math.sign(cx - sx)
  const r = Math.max(0, Math.min(12, Math.abs(cx - sx) / 2, (cy - m) / 2, CHILD_BUS_RISE / 2))
  return `M${sx} ${sy} V${m - r} Q${sx} ${m} ${sx + dir * r} ${m} H${cx - dir * r} Q${cx} ${m} ${cx} ${m + r} V${cy}`
}

/** Less than this between two cards leaves no room for a line that goes down (or up) and across. */
const MIN_BUS_GAP = 24
/** A detour keeps this far from the cards it goes around, and runs this far straight out of its own card first. */
const DETOUR_LANE_MARGIN = 28
const DETOUR_STUB = 18

type Point = { x: number; y: number }
export type LineObstacle = { box: CanvasBox }
type Route = { d: string; points: Point[] }

/** Edge to edge: out, across, in, so a card dragged beside its project is still joined cleanly. */
function sideBusPath(from: CanvasBox, to: CanvasBox): string {
  const toRight = to.x + to.w / 2 > from.x + from.w / 2
  const sx = toRight ? from.x + from.w : from.x
  const cx = toRight ? to.x : to.x + to.w
  const sy = from.y + from.h / 2
  const cy = to.y + to.h / 2
  if (Math.abs(cx - sx) < 1 || (toRight ? cx <= sx : cx >= sx)) {
    return ''
  }
  if (Math.abs(cy - sy) < 1) {
    return `M${sx} ${sy} H${cx}`
  }
  const m = (sx + cx) / 2
  const dir = Math.sign(cx - sx)
  const vertical = Math.sign(cy - sy)
  const r = Math.min(12, Math.abs(cx - sx) / 2, Math.abs(cy - sy) / 2)
  return `M${sx} ${sy} H${m - dir * r} Q${m} ${sy} ${m} ${sy + vertical * r} V${cy - vertical * r} Q${m} ${cy} ${m + dir * r} ${cy} H${cx}`
}

/** Down, across, down (or the mirror going up): the shape every line has when nothing is in its way. */
function busPoints(from: CanvasBox, to: CanvasBox, up: boolean, midY?: number): Point[] {
  const sx = from.x + from.w / 2
  const sy = up ? from.y : from.y + from.h
  const cx = to.x + to.w / 2
  const cy = up ? to.y + to.h : to.y
  const m = midY ?? (sy + cy) / 2
  return [
    { x: sx, y: sy },
    { x: sx, y: m },
    { x: cx, y: m },
    { x: cx, y: cy }
  ]
}

/** True when a straight (horizontal or vertical) piece of the route runs through the inside of a card. */
function routeHitsCard(points: readonly Point[], cards: readonly CanvasBox[]): boolean {
  const inset = 2
  for (let i = 1; i < points.length; i++) {
    const minX = Math.min(points[i - 1].x, points[i].x)
    const maxX = Math.max(points[i - 1].x, points[i].x)
    const minY = Math.min(points[i - 1].y, points[i].y)
    const maxY = Math.max(points[i - 1].y, points[i].y)
    for (const card of cards) {
      if (
        maxX > card.x + inset &&
        minX < card.x + card.w - inset &&
        maxY > card.y + inset &&
        minY < card.y + card.h - inset
      ) {
        return true
      }
    }
  }
  return false
}

/** Rounded path through the points, with the corner radius the plain lines use. */
function roundedPath(points: readonly Point[]): string {
  let d = `M${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const here = points[i]
    const next = points[i + 1]
    const inLength = Math.abs(here.x - prev.x) + Math.abs(here.y - prev.y)
    const outLength = Math.abs(next.x - here.x) + Math.abs(next.y - here.y)
    const r = Math.min(12, inLength / 2, outLength / 2)
    const inX = Math.sign(here.x - prev.x)
    const inY = Math.sign(here.y - prev.y)
    const outX = Math.sign(next.x - here.x)
    const outY = Math.sign(next.y - here.y)
    d += ` L${here.x - inX * r} ${here.y - inY * r} Q${here.x} ${here.y} ${here.x + outX * r} ${here.y + outY * r}`
  }
  const last = points.at(-1) ?? points[0]
  return `${d} L${last.x} ${last.y}`
}

/** Leaves its card straight, runs down a free lane beside what is in the way, then comes in straight. */
function laneDetour(
  from: CanvasBox,
  to: CanvasBox,
  up: boolean,
  cards: readonly CanvasBox[]
): string {
  const sx = from.x + from.w / 2
  const sy = up ? from.y : from.y + from.h
  const cx = to.x + to.w / 2
  const cy = up ? to.y + to.h : to.y
  const dir = up ? -1 : 1
  const top = Math.min(sy, cy)
  const bottom = Math.max(sy, cy)
  const inWay = cards.filter((card) => card.y < bottom && card.y + card.h > top)
  const left = Math.min(from.x, to.x, ...inWay.map((card) => card.x)) - DETOUR_LANE_MARGIN
  const right =
    Math.max(from.x + from.w, to.x + to.w, ...inWay.map((card) => card.x + card.w)) +
    DETOUR_LANE_MARGIN
  const lane =
    Math.abs(sx - left) + Math.abs(cx - left) <= Math.abs(sx - right) + Math.abs(cx - right)
      ? left
      : right
  return roundedPath([
    { x: sx, y: sy },
    { x: sx, y: sy + dir * DETOUR_STUB },
    { x: lane, y: sy + dir * DETOUR_STUB },
    { x: lane, y: cy - dir * DETOUR_STUB },
    { x: cx, y: cy - dir * DETOUR_STUB },
    { x: cx, y: cy }
  ])
}

/** The plain route, or the lane detour when another card sits on the plain one. */
function clearRoute(
  plain: Route,
  from: CanvasBox,
  to: CanvasBox,
  up: boolean,
  obstacles: readonly LineObstacle[]
): string {
  const cards = obstacles.map((o) => o.box).filter((box) => box !== from && box !== to)
  return routeHitsCard(plain.points, cards) ? laneDetour(from, to, up, cards) : plain.d
}

/**
 * Project → chat, leaving the side of the project that faces the chat: down to a chat below it, up to a chat
 * above it, sideways to one beside it. No line runs through its own two cards, wherever the user dragged
 * them, and a line goes around any other card that sits on its way.
 */
export function projectChatPath(
  project: CanvasBox,
  chat: CanvasBox,
  obstacles: readonly LineObstacle[] = []
): string {
  if (chat.y - (project.y + project.h) >= MIN_BUS_GAP) {
    const plain = { d: busPath(project, chat), points: busPoints(project, chat, false) }
    return clearRoute(plain, project, chat, false, obstacles)
  }
  if (project.y - (chat.y + chat.h) >= MIN_BUS_GAP) {
    const plain = { d: busPathUp(project, chat), points: busPoints(project, chat, true) }
    return clearRoute(plain, project, chat, true, obstacles)
  }
  return sideBusPath(project, chat)
}

/** Chat → a chat it created, the same way: below it as usual, above or beside it when dragged there. */
export function createdChatLinkPath(
  creator: CanvasBox,
  child: CanvasBox,
  obstacles: readonly LineObstacle[] = []
): string {
  if (child.y - (creator.y + creator.h) >= MIN_BUS_GAP) {
    const midY = creator.y + creator.h + CHILD_BUS_RISE
    const plain = {
      d: childChatPath(creator, child),
      points: busPoints(creator, child, false, midY)
    }
    return clearRoute(plain, creator, child, false, obstacles)
  }
  if (creator.y - (child.y + child.h) >= MIN_BUS_GAP) {
    const plain = { d: busPathUp(creator, child), points: busPoints(creator, child, true) }
    return clearRoute(plain, creator, child, true, obstacles)
  }
  return sideBusPath(creator, child)
}
