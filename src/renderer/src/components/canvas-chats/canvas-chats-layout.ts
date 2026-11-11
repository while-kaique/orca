import type { CanvasChatHierarchy, CanvasQueueItem } from './canvas-chat-hierarchy'

/** Border states drawn on the flowchart (fork spec: idle gray, working yellow, unseen green, seen dashed green, waiting red). */
/** 'monitoring' = the turn ended but background agents/tasks are still running. */
export type CanvasChatStatus = 'idle' | 'working' | 'monitoring' | 'unseen' | 'seen' | 'waiting'

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
  kind: 'server' | 'artifact'
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

export type CanvasLayout = {
  boxes: Record<string, CanvasBox>
  bounds: CanvasBox
}

export const CANVAS_SIZES = {
  project: { w: 410, h: 116 },
  chat: { w: 340, h: 230 },
  agent: { w: 316, h: 78 },
  /** Server/artifact: name row + a 16:10 picture of the page. */
  extra: { w: 316, h: 236 }
} as const

// Gaps are 30% over the first version, leaving room for what hangs off each chat.
const COLUMN_GAP = 52
const PROJECT_TO_CHATS = 80
const AGENT_TOP_GAP = 26
const AGENT_GAP = 12
// One empty chat column between projects, so every chat of every row sits on the same column grid.
const PROJECT_GAP = CANVAS_SIZES.chat.w + 2 * COLUMN_GAP
// The header starts at its first chat's left edge; wider than one chat, it overhangs a single-chat block on the right.
const HEADER_OVERHANG = CANVAS_SIZES.project.w - CANVAS_SIZES.chat.w
const ROW_GAP = 195
const AGENT_INDENT = 32
// A squarer grid may cost up to 15% of zoom.
const SQUARE_GRID_TOLERANCE = 0.85

const CHILD_BUS_RISE = PROJECT_TO_CHATS / 2

export type ChatTree = { chat: CanvasChat; children: ChatTree[] }
type Block = { project: CanvasProject; roots: ChatTree[]; w: number; h: number }

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
  const start = find(chatForest(chats))
  if (start) {
    collect(start)
  }
  return out
}

/** Project on top, its chats side by side below, each chat's own chats under it, agents stacked under each chat; blocks wrap into rows that best fit the viewport. */
export function layoutCanvas(
  projects: readonly CanvasProject[],
  viewport: { w: number; h: number }
): CanvasLayout {
  const { project: P, chat: C, agent: A, extra: X } = CANVAS_SIZES
  // What hangs under one chat: agents, then its servers/artifacts (taller, they carry a picture).
  const hangingHeight = (chat: CanvasChat): number => {
    const count = chat.agents.length + chat.extras.length
    return count
      ? AGENT_TOP_GAP + chat.agents.length * A.h + chat.extras.length * X.h + count * AGENT_GAP
      : 0
  }
  const rowWidth = (nodes: readonly ChatTree[]): number =>
    nodes.reduce((sum, node) => sum + treeWidth(node), 0) +
    Math.max(0, nodes.length - 1) * COLUMN_GAP
  const treeWidth = (node: ChatTree): number => Math.max(C.w, rowWidth(node.children))
  const treeHeight = (node: ChatTree): number =>
    C.h +
    hangingHeight(node.chat) +
    (node.children.length ? PROJECT_TO_CHATS + Math.max(...node.children.map(treeHeight)) : 0)
  const blocks: Block[] = projects.map((project) => {
    const roots = chatForest(project.chats)
    return {
      project,
      roots,
      w: Math.max(C.w, rowWidth(roots)),
      h: P.h + (roots.length ? PROJECT_TO_CHATS + Math.max(...roots.map(treeHeight)) : 0)
    }
  })
  const boxes: Record<string, CanvasBox> = {}
  if (blocks.length === 0) {
    return { boxes, bounds: { x: 0, y: 0, w: 0, h: 0 } }
  }
  type Grid = { s: number; rows: Block[][]; W: number; H: number }
  const grids: Grid[] = []
  for (let r = 1; r <= blocks.length; r++) {
    const per = Math.ceil(blocks.length / r)
    const rows: Block[][] = []
    for (let i = 0; i < blocks.length; i += per) {
      rows.push(blocks.slice(i, i + per))
    }
    const W =
      Math.max(
        ...rows.map((row) => row.reduce((sum, b) => sum + b.w, 0) + (row.length - 1) * PROJECT_GAP)
      ) + HEADER_OVERHANG
    const H =
      rows.reduce((sum, row) => sum + Math.max(...row.map((b) => b.h)), 0) +
      (rows.length - 1) * ROW_GAP
    const s = Math.min((viewport.w - 120) / W, (viewport.h - 120) / H)
    if (!grids.some((g) => g.rows.length === rows.length)) {
      grids.push({ s, rows, W, H })
    }
  }
  // Near-equal zoom: the squarer grid wins (4 projects = 2x2, not one long row).
  const topS = Math.max(...grids.map((g) => g.s))
  const squareness = (g: Grid): number => Math.abs(g.rows.length - g.rows[0].length)
  // Before the viewport is measured every zoom is <= 0; the top grid is always a candidate.
  const close = (g: Grid): boolean =>
    g.s === topS || (topS > 0 && g.s >= topS * SQUARE_GRID_TOLERANCE)
  const best =
    grids.filter(close).sort((a, b) => squareness(a) - squareness(b) || b.s - a.s)[0] ?? grids[0]
  let y = 0
  best.rows.forEach((row) => {
    let nextX = 0
    row.forEach((block) => {
      const x = nextX
      nextX += block.w + PROJECT_GAP
      boxes[`project:${block.project.id}`] = { x, y, w: P.w, h: P.h }
      // Each chat sits centered over the chats it created, which form the row below it.
      const placeRow = (nodes: readonly ChatTree[], left: number, top: number): void => {
        let nodeX = left
        for (const node of nodes) {
          const width = treeWidth(node)
          const { chat } = node
          const cx = nodeX + (width - C.w) / 2
          boxes[chat.key] = { x: cx, y: top, w: C.w, h: C.h }
          let stackY = top + C.h + AGENT_TOP_GAP
          const stack = (id: string, size: { w: number; h: number }): void => {
            boxes[id] = { x: cx + AGENT_INDENT, y: stackY, w: size.w, h: size.h }
            stackY += size.h + AGENT_GAP
          }
          chat.agents.forEach((agent) => stack(agent.id, A))
          chat.extras.forEach((extra) => stack(extra.id, X))
          placeRow(
            node.children,
            nodeX + (width - rowWidth(node.children)) / 2,
            top + C.h + hangingHeight(chat) + PROJECT_TO_CHATS
          )
          nodeX += width + COLUMN_GAP
        }
      }
      placeRow(block.roots, x + (block.w - rowWidth(block.roots)) / 2, y + P.h + PROJECT_TO_CHATS)
    })
    y += Math.max(...row.map((b) => b.h)) + ROW_GAP
  })
  return { boxes, bounds: { x: 0, y: 0, w: best.W, h: best.H } }
}

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

/** Chat → a chat it created: down the same left spine as its agents, across above the child, then down into it. */
export function childChatPath(from: CanvasBox, to: CanvasBox): string {
  const sx = from.x + 20
  const sy = from.y + from.h
  const cx = to.x + to.w / 2
  const cy = to.y
  const m = cy - CHILD_BUS_RISE
  if (Math.abs(cx - sx) < 1) {
    return `M${sx} ${sy} V${cy}`
  }
  const dir = Math.sign(cx - sx)
  const r = Math.max(0, Math.min(12, Math.abs(cx - sx) / 2, (m - sy) / 2, CHILD_BUS_RISE / 2))
  return `M${sx} ${sy} V${m - r} Q${sx} ${m} ${sx + dir * r} ${m} H${cx - dir * r} Q${cx} ${m} ${cx} ${m + r} V${cy}`
}

/** Chat → agent like a folder tree: down the left spine, then into the agent's side. */
export function elbowPath(from: CanvasBox, to: CanvasBox): string {
  const sx = from.x + 20
  const my = to.y + to.h / 2
  return `M${sx} ${from.y + from.h} V${my - 8} Q${sx} ${my} ${sx + 8} ${my} H${to.x}`
}
