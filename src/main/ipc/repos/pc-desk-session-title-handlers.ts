import { existsSync } from 'node:fs'
import { ipcMain } from 'electron'
import { spawnProcess } from '@orca/process-host'
import { resolveCliCommand } from '../../../shared/node-cli-command-resolution'
import {
  buildPcDeskSessionTitlePrompt,
  parsePcDeskSessionTitleOutput,
  type PcDeskSessionTitleRequest,
  type PcDeskSessionTitleResult,
  setPcDeskSmartTitlesPreferred
} from '../../../shared/pc-desk-session-title'
import type { SpawnSourceControlAgent } from '../../text-generation/source-control-text-generation-types'
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

let lastResolvedProgram = ''

// Own spawner (same direct-exe path as spawnSourceControlAgent on Windows) so errors can name the program it tried.
const spawnSessionTitleAgent: SpawnSourceControlAgent = (input) => {
  const env = input.env ?? process.env
  const program =
    process.platform === 'win32'
      ? resolveCliCommand(input.binary, { pathEnv: env.PATH ?? env.Path ?? null })
      : input.binary
  lastResolvedProgram = program
  return spawnProcess({ program, args: input.args, env, cwd: input.cwd })
}

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
    operation: 'session-title',
    spawnAgent: spawnSessionTitleAgent
  })
  const result = await execution.result
  if (!result.success) {
    const cwdState = existsSync(request.cwd) ? 'ok' : 'missing'
    return {
      kind: 'error',
      error: `${result.error} [program=${lastResolvedProgram}; cwd ${cwdState}]`
    }
  }
  return parsePcDeskSessionTitleOutput(result.rawOutput, request.currentTitle)
}

export function registerPcDeskSessionTitleHandlers(): void {
  ipcMain.removeHandler('repos:setPcDeskSmartTitles')
  ipcMain.handle('repos:setPcDeskSmartTitles', (_event, enabled: unknown) => {
    setPcDeskSmartTitlesPreferred(enabled === true)
  })
  ipcMain.handle('repos:suggestPcDeskSessionTitle', (_event, request: PcDeskSessionTitleRequest) =>
    suggestPcDeskSessionTitle(request)
  )
}
