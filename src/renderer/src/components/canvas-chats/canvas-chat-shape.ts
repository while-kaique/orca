import type { CanvasBox, CanvasChat } from './canvas-chats-layout'

/** Fork: each role draws its own card inside the same layout slot, so rows and margins never move. */
export type CanvasChatShape = 'card' | 'slim' | 'round'

const SLIM_HEIGHT = 140
const ROUND_SIZE = 200

export function chatShape(chat: CanvasChat): CanvasChatShape {
  const role = chat.hierarchy?.role
  return role === 'planejador' ? 'slim' : role === 'executor' ? 'round' : 'card'
}

/** What the closed card really covers: lines start and end here, not at the empty part of the slot. */
export function chatVisualBox(chat: CanvasChat, slot: CanvasBox): CanvasBox {
  const shape = chatShape(chat)
  if (shape === 'slim') {
    return { ...slot, h: SLIM_HEIGHT }
  }
  if (shape === 'round') {
    return { x: slot.x + (slot.w - ROUND_SIZE) / 2, y: slot.y, w: ROUND_SIZE, h: ROUND_SIZE }
  }
  return slot
}
