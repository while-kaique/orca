/** Border states drawn on the flowchart (fork spec: idle gray, working yellow, unseen green, seen dashed green, waiting red). */
export type CanvasChatStatus = 'idle' | 'working' | 'unseen' | 'seen' | 'waiting'

export type CanvasAgent = {
  id: string
  name: string
  status: CanvasChatStatus
  /** Agent stopped because its chat is waiting on the user (agents never ask the user directly). */
  blocked: boolean
  /** Reserved for agents that run in their own chat tab (not used yet). */
  card: null
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
  agent: { w: 300, h: 64 }
} as const

const COLUMN_GAP = 40
const PROJECT_TO_CHATS = 80
const AGENT_TOP_GAP = 26
const AGENT_GAP = 12
const PROJECT_GAP = 160
const ROW_GAP = 150

type Block = { project: CanvasProject; w: number; h: number }

/** Project on top, its chats side by side below, agents stacked under each chat; blocks wrap into rows that best fit the viewport. */
export function layoutCanvas(
  projects: readonly CanvasProject[],
  viewport: { w: number; h: number }
): CanvasLayout {
  const { project: P, chat: C, agent: A } = CANVAS_SIZES
  const blocks: Block[] = projects.map((project) => {
    const n = project.chats.length
    const maxAgents = Math.max(0, ...project.chats.map((c) => c.agents.length))
    return {
      project,
      w: Math.max(P.w, n * C.w + Math.max(0, n - 1) * COLUMN_GAP),
      h:
        P.h +
        (n ? PROJECT_TO_CHATS + C.h : 0) +
        (maxAgents ? AGENT_TOP_GAP + maxAgents * (A.h + AGENT_GAP) : 0)
    }
  })
  const boxes: Record<string, CanvasBox> = {}
  if (blocks.length === 0) {
    return { boxes, bounds: { x: 0, y: 0, w: 0, h: 0 } }
  }
  let best: { s: number; rows: Block[][]; rowWidths: number[]; W: number; H: number } | null = null
  for (let r = 1; r <= blocks.length; r++) {
    const per = Math.ceil(blocks.length / r)
    const rows: Block[][] = []
    for (let i = 0; i < blocks.length; i += per) {
      rows.push(blocks.slice(i, i + per))
    }
    const rowWidths = rows.map(
      (row) => row.reduce((sum, b) => sum + b.w, 0) + (row.length - 1) * PROJECT_GAP
    )
    const W = Math.max(...rowWidths)
    const H =
      rows.reduce((sum, row) => sum + Math.max(...row.map((b) => b.h)), 0) +
      (rows.length - 1) * ROW_GAP
    const s = Math.min((viewport.w - 120) / W, (viewport.h - 120) / H)
    if (!best || s > best.s) {
      best = { s, rows, rowWidths, W, H }
    }
  }
  let y = 0
  best!.rows.forEach((row, ri) => {
    let x = (best!.W - best!.rowWidths[ri]) / 2
    for (const block of row) {
      const chatsWidth =
        block.project.chats.length * C.w + Math.max(0, block.project.chats.length - 1) * COLUMN_GAP
      const chatsX = x + (block.w - chatsWidth) / 2
      boxes[`project:${block.project.id}`] = { x: x + block.w / 2 - P.w / 2, y, w: P.w, h: P.h }
      block.project.chats.forEach((chat, i) => {
        const cx = chatsX + i * (C.w + COLUMN_GAP)
        const cy = y + P.h + PROJECT_TO_CHATS
        boxes[chat.key] = { x: cx, y: cy, w: C.w, h: C.h }
        chat.agents.forEach((agent, j) => {
          boxes[agent.id] = {
            x: cx + 40,
            y: cy + C.h + AGENT_TOP_GAP + j * (A.h + AGENT_GAP),
            w: A.w,
            h: A.h
          }
        })
      })
      x += block.w + PROJECT_GAP
    }
    y += Math.max(...row.map((b) => b.h)) + ROW_GAP
  })
  return { boxes, bounds: { x: 0, y: 0, w: best!.W, h: best!.H } }
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
