import { chatVisualBox } from './canvas-chat-shape'
import { DEFAULT_CANVAS_INSETS, type CanvasInsets } from './canvas-chats-arrangement'
import { chipsHeight, isFreeChat, type CanvasBox, type CanvasProject } from './canvas-chats-layout'

/** The bottom of the board the drawing must leave free: the legend and the buttons, as they really are on screen. */
export function readCanvasInsets(board: HTMLElement | null): CanvasInsets {
  if (!board) {
    return DEFAULT_CANVAS_INSETS
  }
  const tops = ['.cc-legend', '.cc-actions']
    .map((selector) => board.querySelector(selector)?.getBoundingClientRect().top)
    .filter((top): top is number => top !== undefined)
  const bottom = tops.length
    ? Math.max(0, board.getBoundingClientRect().bottom - Math.min(...tops))
    : 0
  return { ...DEFAULT_CANVAS_INSETS, bottom }
}

export type CanvasView = { x: number; y: number; s: number }

/** What is really drawn: project cards, the closed cards as they look (hexagon, slim card) and the chips that hang off them. */
export function drawnBounds(
  projects: readonly CanvasProject[],
  boxes: Readonly<Record<string, CanvasBox>>
): CanvasBox {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const take = (b: CanvasBox, above = 0, below = 0): void => {
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y - above)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h + below)
  }
  for (const project of projects) {
    const header = boxes[`project:${project.id}`]
    if (header) {
      take(header)
    }
    for (const chat of project.chats) {
      const slot = boxes[chat.key]
      if (!slot) {
        continue
      }
      const hang = chipsHeight(chat)
      if (isFreeChat(chat)) {
        take(chatVisualBox(chat, slot), hang, 0)
      } else {
        take(chatVisualBox(chat, slot), 0, hang)
      }
    }
  }
  return x0 === Infinity ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Zoom and shift that put the drawing in the middle of the free part of the screen, `pad` from each side, never above 1:1. */
export function fitView(
  bounds: CanvasBox,
  viewport: { w: number; h: number },
  insets: CanvasInsets = DEFAULT_CANVAS_INSETS
): CanvasView {
  if (bounds.w === 0 || viewport.w === 0) {
    return { x: 0, y: 0, s: 1 }
  }
  const freeW = viewport.w - 2 * insets.pad
  const freeH = viewport.h - insets.bottom - 2 * insets.pad
  const s = Math.min(freeW / bounds.w, freeH / bounds.h, 1)
  return {
    s,
    x: insets.pad + (freeW - bounds.w * s) / 2 - bounds.x * s,
    y: insets.pad + (freeH - bounds.h * s) / 2 - bounds.y * s
  }
}
