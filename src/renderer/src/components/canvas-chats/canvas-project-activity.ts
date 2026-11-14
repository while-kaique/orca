import type { CanvasChatStatus, CanvasProject } from './canvas-chats-layout'

// Something runs, or waits for the user: a finished turn he has not looked at still counts.
const LIVE_STATUSES: ReadonlySet<CanvasChatStatus> = new Set([
  'working',
  'waiting',
  'unseen',
  'monitoring',
  'team'
])

/** Fork: a project with no chat working or waiting on the user is drawn quiet (grey header, faded cards). */
export function isQuietProject(project: Pick<CanvasProject, 'chats'>): boolean {
  return !project.chats.some(
    (chat) =>
      chat.launching ||
      LIVE_STATUSES.has(chat.status) ||
      chat.agents.some((agent) => LIVE_STATUSES.has(agent.status))
  )
}
