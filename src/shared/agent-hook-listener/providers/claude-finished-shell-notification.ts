import { readClaudeBackgroundAgentTasks } from '../../claude-background-task-inventory'
import type { readClaudeTaskNotification } from '../../claude-task-notification-text'
import type { HookListenerState } from '../listener-state'

function runsNonAgentWork(entry: unknown): boolean {
  return readClaudeBackgroundAgentTasks({ background_tasks: [entry] }).hasRunningNonAgentTask
}

/** Remember which shells the latest inventory called running, but only when it named every one of them. */
export function recordClaudeRunningNonAgentTaskIds(
  state: HookListenerState,
  paneKey: string,
  rawInventory: unknown,
  inventory: ReturnType<typeof readClaudeBackgroundAgentTasks>
): void {
  if (!inventory.present) {
    return
  }
  const runningCount = Array.isArray(rawInventory)
    ? rawInventory.filter(runsNonAgentWork).length
    : 0
  const ids = inventory.runningNonAgentTaskIds
  if (ids.length > 0 && ids.length === runningCount) {
    state.claudeRunningNonAgentTaskIdsByPaneKey.set(paneKey, new Set(ids))
  } else {
    state.claudeRunningNonAgentTaskIdsByPaneKey.delete(paneKey)
  }
}

/** A finished-task notification is the only evidence a shell ended when the turn it wakes is interrupted before any Stop. */
export function releaseClaudeShellFinishedByNotification(
  state: HookListenerState,
  paneKey: string,
  notification: ReturnType<typeof readClaudeTaskNotification>
): void {
  const running = state.claudeRunningNonAgentTaskIdsByPaneKey.get(paneKey)
  if (
    !notification?.status ||
    !running?.has(notification.taskId) ||
    runsNonAgentWork({ id: notification.taskId, type: 'shell', status: notification.status })
  ) {
    return
  }
  running.delete(notification.taskId)
  if (running.size === 0) {
    state.claudeRunningNonAgentTaskIdsByPaneKey.delete(paneKey)
    state.claudeRunningNonAgentTaskPaneKeys.delete(paneKey)
  }
}
