import { useEffect, useRef, useState } from 'react'
import type {
  CanvasHierarchyOrderState,
  CanvasHierarchyQueueItem,
  CanvasHierarchyRole,
  CanvasHierarchySnapshot
} from '../../../../shared/canvas-hierarchy'
import { linkCreatedChats, type CanvasChatLatestEntry } from './canvas-chat-lineage'
import type { CanvasChat } from './canvas-chats-layout'

const REFRESH_MS = 3000
// A chat the hierarchy just launched is written in the registry a moment after its tab opens: look again fast.
const NEW_TAB_REFRESH_MS = 400
const NEW_TAB_REFRESH_WINDOW_MS = 12_000

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

/**
 * Reads each project's `.hierarquia/estado.json` while the flowchart is open: every 3 s, and every 0.4 s for a
 * few seconds after a new tab shows up, because the command writes a launched chat's record just after its tab opens.
 */
export function useCanvasHierarchy(
  folders: readonly string[],
  tabIds: readonly string[]
): { snapshots: readonly CanvasHierarchySnapshot[]; newTabs: ReadonlySet<string> } {
  const key = folders.join('\n')
  const [snapshots, setSnapshots] = useState<readonly CanvasHierarchySnapshot[]>([])
  const snapshotsRef = useRef(snapshots)
  snapshotsRef.current = snapshots
  const readRef = useRef<() => void>(() => undefined)
  const seenTabsRef = useRef<ReadonlySet<string> | null>(null)
  // New tabs whose record has not shown up yet, with the time to stop waiting for each.
  const waitingRef = useRef(new Map<string, number>())
  const [newTabs, setNewTabs] = useState<ReadonlySet<string>>(new Set())
  const fastTimerRef = useRef<number | null>(null)
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
    readRef.current = read
    read()
    const timer = window.setInterval(read, REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [key])
  useEffect(
    () => () => {
      if (fastTimerRef.current !== null) {
        window.clearInterval(fastTimerRef.current)
      }
    },
    []
  )
  const tabKey = tabIds.join('\n')
  useEffect(() => {
    const seen = seenTabsRef.current
    seenTabsRef.current = new Set(tabIds)
    if (!seen) {
      return
    }
    const giveUpAt = Date.now() + NEW_TAB_REFRESH_WINDOW_MS
    for (const id of tabIds) {
      if (!seen.has(id)) {
        waitingRef.current.set(id, giveUpAt)
      }
    }
    if (waitingRef.current.size === 0) {
      return
    }
    setNewTabs(new Set(waitingRef.current.keys()))
    readRef.current()
    // One timer for all waiting tabs: another tab opening or closing meanwhile must not cancel the wait.
    if (fastTimerRef.current === null) {
      fastTimerRef.current = window.setInterval(() => {
        const before = waitingRef.current.size
        for (const [id, limit] of waitingRef.current) {
          if (Date.now() > limit || snapshotsRef.current.some((s) => id in s.chats)) {
            waitingRef.current.delete(id)
          }
        }
        if (waitingRef.current.size !== before) {
          setNewTabs(new Set(waitingRef.current.keys()))
        }
        if (waitingRef.current.size === 0 && fastTimerRef.current !== null) {
          window.clearInterval(fastTimerRef.current)
          fastTimerRef.current = null
          return
        }
        readRef.current()
      }, NEW_TAB_REFRESH_MS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey])
  return { snapshots, newTabs }
}

/** The PO a closed PO's chats move under: one being launched, else the newest open PO the registry calls active. */
function openPoStandingIn(
  chats: readonly CanvasChat[],
  snapshot: CanvasHierarchySnapshot
): CanvasChat | null {
  const launching = chats.find((chat) => chat.launching && !snapshot.chats[chat.key])
  if (launching) {
    return launching
  }
  let newest: CanvasChat | null = null
  for (const [id, known] of Object.entries(snapshot.chats)) {
    const chat = known.papel === 'po' && known.ativo ? chats.find((c) => c.key === id) : null
    if (chat) {
      newest = chat
    }
  }
  return newest
}

/**
 * Where a chat whose creator closed hangs: the nearest open ancestor in the registry; a closed PO's place is taken by
 * the PO standing in. Executors and planners never hang from the project, so a broken chain also ends at that PO.
 */
function livingAncestor(
  firstParent: string,
  role: CanvasHierarchyRole,
  snapshot: CanvasHierarchySnapshot,
  chatByKey: ReadonlyMap<string, CanvasChat>,
  standIn: CanvasChat | null
): CanvasChat | null {
  const seen = new Set<string>()
  for (
    let id: string | null = firstParent;
    id && !seen.has(id);
    id = snapshot.chats[id]?.pai ?? null
  ) {
    seen.add(id)
    const open = chatByKey.get(id)
    if (open) {
      return open
    }
    if (snapshot.chats[id]?.papel === 'po') {
      return standIn
    }
  }
  return role === 'po' ? null : standIn
}

/** Marks each chat with its role and order, fills in creators the status feed lost, and returns the user's queue. */
export function applyCanvasHierarchy(
  chats: CanvasChat[],
  snapshot: CanvasHierarchySnapshot
): CanvasQueueItem[] {
  // The command registers chats by tab id, which is the flowchart's chat key.
  const chatByKey = new Map(chats.map((chat) => [chat.key, chat]))
  const orders = Object.values(snapshot.ordens)
  const standIn = openPoStandingIn(chats, snapshot)
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
    const heir =
      !creator && known.pai
        ? livingAncestor(known.pai, known.papel, snapshot, chatByKey, standIn)
        : null
    if (!chat.parentKey && heir && heir !== chat) {
      chat.parentKey = heir.key
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
  projectFolders: readonly string[],
  creatorByWorktree: ReadonlyMap<string, string> = new Map(),
  newTabs: ReadonlySet<string> = new Set()
): CanvasQueueItem[] {
  linkCreatedChats(chats, latestByChat)
  // Why: a worktree can hold its own `.hierarquia/`; taking only the first one left the main registry's chats as free.
  const queue = snapshots
    .filter((candidate) => projectFolders.includes(candidate.folder))
    .flatMap((snapshot) => applyCanvasHierarchy(chats, snapshot))
  holdUnregisteredChildren(chats, creatorByWorktree, newTabs)
  return queue
}

/**
 * A tab that just opened, made by a hierarchy chat and without its own record yet (the command writes it a moment
 * later), takes its place under that chat instead of showing as a free chat. The creator is the one the agent status
 * names, or the hierarchy chat that sits in the worktree this chat's worktree was branched from. Only new tabs wait:
 * a chat that is still unregistered after the wait is a free chat.
 */
function holdUnregisteredChildren(
  chats: CanvasChat[],
  creatorWorktreeByWorktree: ReadonlyMap<string, string>,
  newTabs: ReadonlySet<string>
): void {
  const byKey = new Map(chats.map((chat) => [chat.key, chat]))
  for (const chat of chats) {
    if (chat.hierarchy || chat.launching || !newTabs.has(chat.key)) {
      continue
    }
    let creator = chat.parentKey ? byKey.get(chat.parentKey) : undefined
    if (!creator) {
      const parentWorktree = creatorWorktreeByWorktree.get(chat.worktreeId)
      creator = chats.find(
        (other) => other.worktreeId === parentWorktree && other.hierarchy && other !== chat
      )
    }
    if (creator?.hierarchy) {
      chat.parentKey = creator.key
      chat.launching = true
    }
  }
}
