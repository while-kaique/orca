import { useEffect, useState } from 'react'
import type {
  CanvasHierarchyOrderState,
  CanvasHierarchyQueueItem,
  CanvasHierarchyRole,
  CanvasHierarchySnapshot
} from '../../../../shared/canvas-hierarchy'
import { linkCreatedChats, type CanvasChatLatestEntry } from './canvas-chat-lineage'
import type { CanvasChat } from './canvas-chats-layout'

const REFRESH_MS = 3000

/** What the project's hierarchy says about one chat. */
export type CanvasChatHierarchy = {
  role: CanvasHierarchyRole
  /** The order this chat is working on (none for the PO). */
  order: { id: string; state: CanvasHierarchyOrderState; rejections: number; title: string } | null
  /** Deliveries of chats it created that wait for this chat to check them. */
  toCheck: number
  touchedByUser: boolean
}

export type CanvasQueueItem = CanvasHierarchyQueueItem & {
  folder: string
  /** Flowchart chat the item came from, when that chat is still open. */
  chatKey: string | null
}

/** Reads each project's `.hierarquia/estado.json` while the flowchart is open. */
export function useCanvasHierarchy(folders: readonly string[]): readonly CanvasHierarchySnapshot[] {
  const key = folders.join('\n')
  const [snapshots, setSnapshots] = useState<readonly CanvasHierarchySnapshot[]>([])
  useEffect(() => {
    let alive = true
    let last = ''
    const read = (): void => {
      void window.api.repos
        .readCanvasHierarchy(key ? key.split('\n') : [])
        .then((next) => {
          const serialized = JSON.stringify(next)
          if (alive && serialized !== last) {
            last = serialized
            setSnapshots(next)
          }
        })
        .catch(() => undefined)
    }
    read()
    const timer = window.setInterval(read, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [key])
  return snapshots
}

/** Marks each chat with its role and order, fills in creators the status feed lost, and returns the user's queue. */
export function applyCanvasHierarchy(
  chats: CanvasChat[],
  snapshot: CanvasHierarchySnapshot
): CanvasQueueItem[] {
  // The command registers chats by tab id, which is the flowchart's chat key.
  const chatByKey = new Map(chats.map((chat) => [chat.key, chat]))
  const orders = Object.values(snapshot.ordens)
  for (const chat of chats) {
    const known = snapshot.chats[chat.key]
    if (!known) {
      continue
    }
    const order = known.ordemId ? snapshot.ordens[known.ordemId] : undefined
    chat.hierarchy = {
      role: known.papel,
      order: order
        ? {
            id: order.id,
            state: order.situacao,
            rejections: order.reprovacoes,
            title: order.titulo
          }
        : null,
      toCheck: orders.filter(
        (o) =>
          o.de === chat.key &&
          (o.situacao === 'conferindo_plano' || o.situacao === 'conferindo_produto')
      ).length,
      touchedByUser: known.mexidoPeloKaique
    }
    const creator = known.pai ? chatByKey.get(known.pai) : undefined
    if (!chat.parentKey && creator && creator !== chat) {
      chat.parentKey = creator.key
    }
  }
  return snapshot.fila.map((item) => ({
    ...item,
    folder: snapshot.folder,
    chatKey: chatByKey.has(item.chatId) ? item.chatId : null
  }))
}

/** One project's chats: who created whom, then role, delivery state and the user's queue. */
export function linkProjectChats(
  chats: CanvasChat[],
  latestByChat: ReadonlyMap<string, CanvasChatLatestEntry>,
  snapshots: readonly CanvasHierarchySnapshot[],
  projectFolders: readonly string[]
): CanvasQueueItem[] {
  linkCreatedChats(chats, latestByChat)
  // Why: a worktree can hold its own `.hierarquia/`; taking only the first one left the main registry's chats as free.
  return snapshots
    .filter((candidate) => projectFolders.includes(candidate.folder))
    .flatMap((snapshot) => applyCanvasHierarchy(chats, snapshot))
}
