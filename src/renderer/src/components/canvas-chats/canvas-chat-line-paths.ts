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
