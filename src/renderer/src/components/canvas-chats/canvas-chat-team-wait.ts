import type { CanvasChat, CanvasChatStatus } from './canvas-chats-layout'

/** Only a chat that is not mid-turn and does not need the user can be shown as waiting on its team. */
export function canWaitForTeam(status: CanvasChatStatus): boolean {
  return status === 'idle' || status === 'seen' || status === 'unseen'
}

/** Fork: marks each chat that has a chat it created (at any depth) working, from the status already computed per chat. */
export function markChatsAwaitingTeam(chats: CanvasChat[]): void {
  const childrenByParent = new Map<string, CanvasChat[]>()
  for (const chat of chats) {
    if (chat.parentKey && chat.parentKey !== chat.key) {
      childrenByParent.set(chat.parentKey, [...(childrenByParent.get(chat.parentKey) ?? []), chat])
    }
  }
  const teamWorking = (chat: CanvasChat, seen: Set<string>): boolean =>
    (childrenByParent.get(chat.key) ?? []).some((child) => {
      if (seen.has(child.key)) {
        return false
      }
      seen.add(child.key)
      return child.status === 'working' || teamWorking(child, seen)
    })
  const waiting = chats.filter(
    (chat) => canWaitForTeam(chat.status) && teamWorking(chat, new Set([chat.key]))
  )
  for (const chat of waiting) {
    chat.awaitingTeam = true
    chat.status = 'team'
  }
}
