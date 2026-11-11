import { isAskUserQuestionTool } from '../../agent-status/lifecycle/agent-question-answered-intent'
import { readString } from '../tool-input-preview'

/** Auto mode's classifier answers these requests itself and no hook reports the answer; only tools that always ask the person still wait. */
function isClassifierResolvedPermission(
  eventName: unknown,
  hookPayload: Record<string, unknown>
): boolean {
  const toolName = readString(hookPayload, 'tool_name')
  return (
    eventName === 'PermissionRequest' &&
    hookPayload['permission_mode'] === 'auto' &&
    !isAskUserQuestionTool(toolName) &&
    toolName !== 'ExitPlanMode'
  )
}

/** The state a Claude hook reports for the lead, or null when the event says nothing about it. */
export function claudeReportedStateName(
  eventName: unknown,
  hookPayload: Record<string, unknown>,
  isAskUserQuestion: boolean,
  endsTurn: boolean
): 'working' | 'waiting' | 'done' | null {
  if (
    eventName === 'UserPromptSubmit' ||
    eventName === 'PostToolUse' ||
    eventName === 'PostToolUseFailure' ||
    (eventName === 'PreToolUse' && !isAskUserQuestion) ||
    isClassifierResolvedPermission(eventName, hookPayload)
  ) {
    return 'working'
  }
  if (eventName === 'PermissionRequest' || eventName === 'Elicitation' || isAskUserQuestion) {
    return 'waiting'
  }
  return endsTurn ? 'done' : null
}
