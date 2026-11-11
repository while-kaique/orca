import type { CanvasBox, CanvasChat } from './canvas-chats-layout'

/** Fork: each role draws its own card inside the same layout slot, so rows and margins never move. */
export type CanvasChatShape = 'card' | 'slim' | 'crest'

const SLIM_HEIGHT = 106
/** The hexagon's drawing and the room it keeps in the layout; it is drawn smaller, centered in that room. */
export const EXECUTOR_CREST = { w: 200, h: 214 }
export const EXECUTOR_CREST_SCALE = 0.75

export function chatShape(chat: CanvasChat): CanvasChatShape {
  const role = chat.hierarchy?.role
  return role === 'planejador' ? 'slim' : role === 'executor' ? 'crest' : 'card'
}

/** What the closed card really covers: lines start and end here, not at the empty part of the slot. */
export function chatVisualBox(chat: CanvasChat, slot: CanvasBox): CanvasBox {
  const shape = chatShape(chat)
  if (shape === 'slim') {
    return { ...slot, h: SLIM_HEIGHT }
  }
  if (shape === 'crest') {
    const w = EXECUTOR_CREST.w * EXECUTOR_CREST_SCALE
    const h = EXECUTOR_CREST.h * EXECUTOR_CREST_SCALE
    return { x: slot.x + (slot.w - w) / 2, y: slot.y + (EXECUTOR_CREST.h - h) / 2, w, h }
  }
  return slot
}

/** Height a chat keeps in its row: the hexagon keeps its full room, so shrinking it moves no other chat. */
export function chatFootprintHeight(chat: CanvasChat, slotHeight: number): number {
  const shape = chatShape(chat)
  return shape === 'slim' ? SLIM_HEIGHT : shape === 'crest' ? EXECUTOR_CREST.h : slotHeight
}
