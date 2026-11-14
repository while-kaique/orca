import type { CanvasChatHierarchy, CanvasQueueItem } from './canvas-chat-hierarchy'
import { chatFootprintHeight, chatVisualBox } from './canvas-chat-shape'
import { familyLineBoxes, hangsFromChatsOnly, joinStacked, rowBands } from './canvas-chats-outline'

/** Border states drawn on the flowchart (fork spec: idle gray, working yellow, unseen green, seen dashed green, waiting red). */
/** 'monitoring' = the turn ended but background agents/tasks are still running. */
/** 'team' = the chat is idle and waits for chats it created that are still working. */
export type CanvasChatStatus =
  | 'idle'
  | 'working'
  | 'monitoring'
  | 'unseen'
  | 'seen'
  | 'waiting'
  | 'team'

export type CanvasAgent = {
  id: string
  /** 'task': a background command/monitor the chat left running (e.g. a long training). */
  kind: 'agent' | 'task'
  name: string
  status: CanvasChatStatus
  /** Agent stopped because its chat is waiting on the user (agents never ask the user directly). */
  blocked: boolean
  /** Reserved for agents that run in their own chat tab (not used yet). */
  card: null
}

export type CanvasExtra = {
  id: string
  /** 'image': a picture file the chat printed; `url` is its path on disk. */
  kind: 'server' | 'artifact' | 'image'
  label: string
  url: string
  /** Set for servers: what the stop button needs. */
  server?: { repoId: string; pid: number; port: number; worktreeId: string }
}

export type CanvasChat = {
  /** The chat's tab id (same id the sidebar row and terminal view use). */
  key: string
  /** Project (repo) this chat belongs to. */
  projectId: string
  worktreeId: string
  tabId: string
  /** Workspace folder, where Haiku runs to summarize the chat. */
  cwd: string
  /** Newest agent pane of this chat, for marking it seen. */
  paneKey: string | null
  ptyId: string | null
  startedAt: number
  title: string
  /** The chat that created this one (orchestration), when it is a chat of the same project. */
  parentKey: string | null
  /** The chat's Claude transcript, where its context size is read from. */
  transcriptPath: string | null
  /** Provider model id the chat is running, as the sidebar reads it. */
  model: string | null
  /** Role and delivery state, when the project keeps a chat hierarchy. */
  hierarchy: CanvasChatHierarchy | null
  status: CanvasChatStatus
  /** A PO being launched: it has no role yet but already takes the PO's place under the project. */
  launching?: boolean
  /** A chat it created (directly or further down) is working while this one is idle. */
  awaitingTeam?: boolean
  lines: { role: 'user' | 'agent' | 'ask'; text: string }[]
  agents: CanvasAgent[]
  /** Localhost servers this chat's terminal started, and claude.ai artifacts it printed. */
  extras: CanvasExtra[]
}

export type CanvasProject = {
  id: string
  name: string
  /** Project color (the sidebar badge color, or an automatic one while that is still the default gray). */
  color: string
  initials: string
  detail: string
  chats: CanvasChat[]
  /** What waits for the user in this project's chat hierarchy. */
  queue: CanvasQueueItem[]
}

export type CanvasBox = { x: number; y: number; w: number; h: number }

export const CANVAS_SIZES = {
  project: { w: 410, h: 116 },
  chat: { w: 340, h: 230 }
} as const

/** The thin row of chips under a chat: one per kind of thing it left (agents, artifacts, servers, images). */
export const CANVAS_ATTACHMENTS_ROW = { gap: 8, h: 30 } as const

export const COLUMN_GAP = 52
export const PROJECT_TO_CHATS = 80
/** Half a column: every card of every project starts on a multiple of this, counted from the same origin. */
export const GRID_STEP = (CANVAS_SIZES.chat.w + COLUMN_GAP) / 2
/** Least empty space between the drawn shapes of two different projects, across and down. */
// Why: the user wants the smallest margin that still shows between projects, the same as between two cards of a row.
export const PROJECT_GAP_X = COLUMN_GAP
export const PROJECT_GAP_Y = COLUMN_GAP
export const PACK_RULES = { grid: GRID_STEP, gapX: PROJECT_GAP_X, gapY: PROJECT_GAP_Y } as const

/** A chat outside the hierarchy: it sits above its project, never under it. A PO being launched is not free. */
export const isFreeChat = (chat: CanvasChat): boolean => chat.hierarchy === null && !chat.launching

export type ChatTree = { chat: CanvasChat; children: ChatTree[] }
export type Block = {
  project: CanvasProject
  roots: ChatTree[]
  /** Chats outside the hierarchy, side by side above the project. */
  free: CanvasChat[]
  /** Room above the project card: free chats, the chips that hang above them, and the line gap. */
  up: number
  /** Row of each chat, and where each row starts below the project. */
  tiers: Map<string, number>
  tierTops: number[]
  w: number
  h: number
}
const ROLE_TIER = { po: 0, planejador: 1, executor: 2 } as const
const roleTier = (chat: CanvasChat): number => (chat.hierarchy ? ROLE_TIER[chat.hierarchy.role] : 0)

/** Chats created by another chat of the same project hang under it; every other chat is a root. */
export function chatForest(chats: readonly CanvasChat[]): ChatTree[] {
  const nodes = new Map<string, ChatTree>(chats.map((chat) => [chat.key, { chat, children: [] }]))
  const reachesItself = (start: CanvasChat): boolean => {
    let key = start.parentKey
    for (let step = 0; key && step < chats.length; step++) {
      if (key === start.key) {
        return true
      }
      key = nodes.get(key)?.chat.parentKey ?? null
    }
    return false
  }
  const roots: ChatTree[] = []
  for (const node of nodes.values()) {
    const parent = node.chat.parentKey ? nodes.get(node.chat.parentKey) : undefined
    // A creation loop has no top: its chats stay visible as roots instead of vanishing.
    if (parent && !reachesItself(node.chat)) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  // Planners first, then the executors a chat created directly: the tree reads left to right, top to bottom.
  for (const node of nodes.values()) {
    node.children.sort((a, b) => roleTier(a.chat) - roleTier(b.chat))
  }
  return roots
}

/** Every chat below this one, for dragging a chat together with what it created. */
export function chatDescendants(chats: readonly CanvasChat[], key: string): CanvasChat[] {
  const out: CanvasChat[] = []
  const collect = (node: ChatTree): void => {
    for (const child of node.children) {
      out.push(child.chat)
      collect(child)
    }
  }
  const find = (nodes: readonly ChatTree[]): ChatTree | undefined => {
    for (const node of nodes) {
      const hit = node.chat.key === key ? node : find(node.children)
      if (hit) {
        return hit
      }
    }
    return undefined
  }
  // Only hierarchy chats hang under a creator; a free chat has nothing under it.
  const start = find(chatForest(chats.filter((chat) => !isFreeChat(chat))))
  if (start) {
    collect(start)
  }
  return out
}

/** Changes when a chat comes or goes, moves under another, or crosses between free and hierarchy: the layout must be redone. */
export const canvasStructureKey = (projects: readonly CanvasProject[]): string =>
  projects
    .map(
      (p) =>
        `${p.id}:${p.chats.map((c) => `${c.key}/${c.parentKey ?? ''}/${c.agents.length}/${c.extras.length}/${isFreeChat(c) ? 'f' : 't'}`).join(',')}`
    )
    .join('|')

export type BlockPlan = {
  block: Block
  /** Every box of the block (header, chats, free chats), measured from the block's origin (a multiple of GRID_STEP). */
  local: Record<string, CanvasBox>
  /** What the block really covers: one rectangle per row (drawn cards, chips, and the line gap above), not the whole box. */
  shape: CanvasBox[]
  /** The project card, where the project's anchor sits. */
  header: CanvasBox
}

export const chipsHeight = (chat: CanvasChat): number =>
  chat.agents.length + chat.extras.length > 0
    ? CANVAS_ATTACHMENTS_ROW.gap + CANVAS_ATTACHMENTS_ROW.h
    : 0

/** Each project laid out on its own, before it is given a place among the others. */
export function planBlocks(projects: readonly CanvasProject[]): BlockPlan[] {
  const { project: P, chat: C } = CANVAS_SIZES
  const drawnHeight = (chat: CanvasChat): number => chatFootprintHeight(chat, C.h)
  const rowWidth = (nodes: readonly ChatTree[]): number =>
    nodes.reduce((sum, node) => sum + treeWidth(node), 0) +
    Math.max(0, nodes.length - 1) * COLUMN_GAP
  const treeWidth = (node: ChatTree): number => Math.max(C.w, rowWidth(node.children))
  const freeRowWidth = (count: number): number =>
    count ? count * C.w + (count - 1) * COLUMN_GAP : 0
  const blocks: Block[] = projects.map((project) => {
    const free = project.chats.filter(isFreeChat)
    const tree = project.chats.filter((chat) => !isFreeChat(chat))
    const roots = chatForest(tree)
    // Rows by role: every executor sits below the planners' row, even one the PO created directly.
    const tiers = new Map<string, number>()
    const hanging: number[] = []
    // A row is as tall as what is drawn in it: slim planners and hexagon executors need less than a full card.
    const heights: number[] = []
    const assign = (nodes: readonly ChatTree[], above: number): void => {
      for (const node of nodes) {
        const tier = Math.max(above + 1, roleTier(node.chat))
        tiers.set(node.chat.key, tier)
        heights[tier] = Math.max(heights[tier] ?? 0, drawnHeight(node.chat))
        // Only what hangs off a chat with chats below it pushes the next row down; the rest has its own column.
        hanging[tier] = Math.max(
          hanging[tier] ?? 0,
          node.children.length ? chipsHeight(node.chat) : 0
        )
        assign(node.children, tier)
      }
    }
    assign(roots, -1)
    const tierTops: number[] = []
    for (let tier = 0; tier < hanging.length; tier++) {
      // A row nobody sits in takes no room: an executor under the PO sits as close as under a planner.
      tierTops[tier] =
        tier === 0 || heights[tier - 1] === undefined
          ? (tierTops[tier - 1] ?? 0)
          : tierTops[tier - 1] + heights[tier - 1] + (hanging[tier - 1] ?? 0) + PROJECT_TO_CHATS
    }
    const bottom = Math.max(
      0,
      ...tree.map(
        (chat) => tierTops[tiers.get(chat.key) ?? 0] + drawnHeight(chat) + chipsHeight(chat)
      )
    )
    const up = free.length ? PROJECT_TO_CHATS + C.h + Math.max(...free.map(chipsHeight)) : 0
    return {
      project,
      roots,
      free,
      up,
      tiers,
      tierTops,
      w: Math.max(C.w, rowWidth(roots), freeRowWidth(free.length)),
      h: up + P.h + (roots.length ? PROJECT_TO_CHATS + bottom : 0)
    }
  })
  return blocks.map((block) => {
    const local: Record<string, CanvasBox> = {}
    const projectTop = block.up
    const projectKey = `project:${block.project.id}`
    local[projectKey] = { x: 0, y: projectTop, w: P.w, h: P.h }
    const chatsTop = projectTop + P.h + PROJECT_TO_CHATS
    // Each chat sits centered over the chats it created, on the row of its role.
    const parentOf = new Map<string, string>()
    const placeRow = (nodes: readonly ChatTree[], left: number): void => {
      let nodeX = left
      for (const node of nodes) {
        const width = treeWidth(node)
        const { chat } = node
        const top = chatsTop + block.tierTops[block.tiers.get(chat.key) ?? 0]
        const cx = nodeX + (width - C.w) / 2
        local[chat.key] = { x: cx, y: top, w: C.w, h: C.h }
        for (const child of node.children) {
          parentOf.set(child.chat.key, chat.key)
        }
        placeRow(node.children, nodeX + (width - rowWidth(node.children)) / 2)
        nodeX += width + COLUMN_GAP
      }
    }
    placeRow(block.roots, (block.w - rowWidth(block.roots)) / 2)
    // Free chats share one row above the project, bottoms level, centered on the block.
    block.free.forEach((chat, index) => {
      local[chat.key] = {
        x: (block.w - freeRowWidth(block.free.length)) / 2 + index * (C.w + COLUMN_GAP),
        y: projectTop - PROJECT_TO_CHATS - C.h,
        w: C.w,
        h: C.h
      }
    })
    // The project card is centered over its top chats (the chats rows are centered on the block too): the line down is straight.
    local[projectKey].x = (block.w - P.w) / 2
    const header = local[projectKey]
    // The outline is what is drawn: a band per row of cards (with their chips) and, above it, a thin band per family for
    // the lines from the parent to its chats, so the margin to another project is the one seen on screen.
    const shape: CanvasBox[] = []
    if (block.free.length) {
      const boxes = block.free.map((chat) => local[chat.key])
      const left = Math.min(...boxes.map((b) => b.x))
      const right = Math.max(...boxes.map((b) => b.x + b.w))
      const cardsBottom = boxes[0].y + boxes[0].h
      shape.push({ x: left, y: 0, w: right - left, h: cardsBottom })
      shape.push(
        ...familyLineBoxes(
          header,
          boxes,
          boxes.map((b) => (header.y + b.y + b.h) / 2)
        )
      )
    }
    shape.push(header)
    const drawn = (chat: CanvasChat): CanvasBox => chatVisualBox(chat, local[chat.key])
    const chatByKey = new Map(block.project.chats.map((chat) => [chat.key, chat]))
    const byTier = new Map<number, CanvasChat[]>()
    for (const [key, tier] of block.tiers) {
      byTier.set(tier, [...(byTier.get(tier) ?? []), chatByKey.get(key) as CanvasChat])
    }
    for (const chats of byTier.values()) {
      const boxes = chats.map(drawn)
      shape.push(
        ...rowBands(
          chats.map((chat, i) => ({ ...boxes[i], h: boxes[i].h + chipsHeight(chat) })),
          COLUMN_GAP
        )
      )
      // Lines from the project bottom bend halfway down; lines from a chat bend PROJECT_TO_CHATS / 2 under it.
      const families = new Map<string, CanvasBox[]>()
      chats.forEach((chat, i) => {
        const parentKey = parentOf.get(chat.key) ?? projectKey
        if (parentKey === projectKey && hangsFromChatsOnly(chat)) {
          return
        }
        families.set(parentKey, [...(families.get(parentKey) ?? []), boxes[i]])
      })
      for (const [parentKey, kids] of families) {
        const parentChat = chatByKey.get(parentKey)
        const parent = parentChat ? drawn(parentChat) : header
        const below = parent.y + parent.h
        shape.push(
          ...familyLineBoxes(
            parent,
            kids,
            kids.map((kid) => (parentChat ? below + PROJECT_TO_CHATS / 2 : (below + kid.y) / 2))
          )
        )
      }
    }
    return { block, local, shape: joinStacked(shape), header }
  })
}
