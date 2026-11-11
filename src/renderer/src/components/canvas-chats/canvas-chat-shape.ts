import type { CanvasBox, CanvasChat } from './canvas-chats-layout'

/** Fork: each role draws its own card inside the same layout slot, so rows and margins never move. */
export type CanvasChatShape = 'card' | 'slim' | 'crest'

const SLIM_HEIGHT = 106
export const EXECUTOR_CREST = { w: 200, h: 214 }

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
    const { w, h } = EXECUTOR_CREST
    return { x: slot.x + (slot.w - w) / 2, y: slot.y, w, h }
  }
  return slot
}
