import { ipcMain } from 'electron'
import {
  buildPcDeskSessionTitlePrompt,
  parsePcDeskSessionTitleOutput,
  type PcDeskSessionTitleRequest,
  type PcDeskSessionTitleResult
} from '../../../shared/pc-desk-session-title'
import { spawnSourceControlAgent } from '../../text-generation/source-control-agent-launch'
import { runLocalSourceControlPlan } from '../../text-generation/source-control-local-process'

// Why these flags: a background naming call must not fire the user's hooks (session diaries),
// load MCP servers or tools, or leave a session behind in Claude's resume list.
const CLAUDE_SESSION_TITLE_ARGS = [
  '-p',
  '--model',
  'haiku',
  '--output-format',
  'text',
  '--setting-sources',
  '',
  '--no-session-persistence',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--tools',
  ''
]

export async function suggestPcDeskSessionTitle(
  request: PcDeskSessionTitleRequest
): Promise<PcDeskSessionTitleResult> {
  if (request.recentPrompts.length === 0) {
    return { kind: 'keep' }
  }
  const execution = runLocalSourceControlPlan({
    plan: {
      binary: 'claude',
      args: CLAUDE_SESSION_TITLE_ARGS,
      stdinPayload: buildPcDeskSessionTitlePrompt(request),
      label: 'Claude'
    },
    cwd: request.cwd,
    env: undefined,
    emptyResultName: 'session title',
    operation: 'session-title',
    holdHomeLockUntilExit: false,
    spawnAgent: spawnSourceControlAgent
  })
  const result = await execution.result
  if (!result.success) {
    return { kind: 'error', error: result.error }
  }
  return parsePcDeskSessionTitleOutput(result.rawOutput, request.currentTitle)
}

export function registerPcDeskSessionTitleHandlers(): void {
  ipcMain.handle('repos:suggestPcDeskSessionTitle', (_event, request: PcDeskSessionTitleRequest) =>
    suggestPcDeskSessionTitle(request)
  )
}
