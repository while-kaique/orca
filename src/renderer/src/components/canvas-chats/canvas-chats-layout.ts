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
const PROJECT_GAP = 208
const ROW_GAP = 195
const AGENT_INDENT = 32
// A squarer grid may cost up to 15% of zoom.
const SQUARE_GRID_TOLERANCE = 0.85

type Block = { project: CanvasProject; w: number; h: number }

/** Project on top, its chats side by side below, agents stacked under each chat; blocks wrap into rows that best fit the viewport. */
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
  const blocks: Block[] = projects.map((project) => {
    const n = project.chats.length
    return {
      project,
      w: Math.max(P.w, n * C.w + Math.max(0, n - 1) * COLUMN_GAP),
      h: P.h + (n ? PROJECT_TO_CHATS + C.h : 0) + Math.max(0, ...project.chats.map(hangingHeight))
    }
  })
  const boxes: Record<string, CanvasBox> = {}
  if (blocks.length === 0) {
    return { boxes, bounds: { x: 0, y: 0, w: 0, h: 0 } }
  }
  type Grid = { s: number; rows: Block[][]; colWidths: number[]; W: number; H: number }
  const grids: Grid[] = []
  for (let r = 1; r <= blocks.length; r++) {
    const per = Math.ceil(blocks.length / r)
    const rows: Block[][] = []
    for (let i = 0; i < blocks.length; i += per) {
      rows.push(blocks.slice(i, i + per))
    }
    // A grid: each column is as wide as its widest project, so projects line up across rows.
    const colWidths = Array.from({ length: per }, (_, c) =>
      Math.max(0, ...rows.map((row) => row[c]?.w ?? 0))
    )
    const W = colWidths.reduce((sum, w) => sum + w, 0) + (per - 1) * PROJECT_GAP
    const H =
      rows.reduce((sum, row) => sum + Math.max(...row.map((b) => b.h)), 0) +
      (rows.length - 1) * ROW_GAP
    const s = Math.min((viewport.w - 120) / W, (viewport.h - 120) / H)
    if (!grids.some((g) => g.rows.length === rows.length)) {
      grids.push({ s, rows, colWidths, W, H })
    }
  }
  // Near-equal zoom: the squarer grid wins (4 projects = 2x2, not one long row).
  const topS = Math.max(...grids.map((g) => g.s))
  const squareness = (g: Grid): number => Math.abs(g.rows.length - g.rows[0].length)
  const best = grids
    .filter((g) => g.s >= topS * SQUARE_GRID_TOLERANCE)
    .sort((a, b) => squareness(a) - squareness(b) || b.s - a.s)[0]
  let y = 0
  best.rows.forEach((row) => {
    let cellX = 0
    row.forEach((block, c) => {
      const cellW = best.colWidths[c]
      const x = cellX + (cellW - block.w) / 2
      cellX += cellW + PROJECT_GAP
      const chatsWidth =
        block.project.chats.length * C.w + Math.max(0, block.project.chats.length - 1) * COLUMN_GAP
      const chatsX = x + (block.w - chatsWidth) / 2
      boxes[`project:${block.project.id}`] = { x: x + block.w / 2 - P.w / 2, y, w: P.w, h: P.h }
      block.project.chats.forEach((chat, i) => {
        const cx = chatsX + i * (C.w + COLUMN_GAP)
        const cy = y + P.h + PROJECT_TO_CHATS
        boxes[chat.key] = { x: cx, y: cy, w: C.w, h: C.h }
        let stackY = cy + C.h + AGENT_TOP_GAP
        const stack = (id: string, size: { w: number; h: number }): void => {
          boxes[id] = { x: cx + AGENT_INDENT, y: stackY, w: size.w, h: size.h }
          stackY += size.h + AGENT_GAP
        }
        chat.agents.forEach((agent) => stack(agent.id, A))
        chat.extras.forEach((extra) => stack(extra.id, X))
      })
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

/** Chat → agent like a folder tree: down the left spine, then into the agent's side. */
export function elbowPath(from: CanvasBox, to: CanvasBox): string {
  const sx = from.x + 20
  const my = to.y + to.h / 2
  return `M${sx} ${from.y + from.h} V${my - 8} Q${sx} ${my} ${sx + 8} ${my} H${to.x}`
}
