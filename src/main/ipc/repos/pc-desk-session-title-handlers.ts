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

const CANVAS_SUMMARY_MAX_INPUT = 4000

/** Fork: one-line headline of where a chat's work stands, for the flowchart card. */
export async function summarizeCanvasReply(request: {
  cwd: string
  text: string
}): Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }> {
  const text = request.text.trim().slice(-CANVAS_SUMMARY_MAX_INPUT)
  if (!text) {
    return { kind: 'error', error: 'empty' }
  }
  const prompt = [
    'Leia a resposta abaixo, de um assistente de código, e escreva UMA manchete curta em português',
    '(no máximo 8 palavras) dizendo em que pé o trabalho está, para quem só bate o olho.',
    'Exemplos do tom: "Testes concluídos, mas com ressalvas" · "MVP do projeto finalizado" ·',
    '"Antes de seguir, há perguntas para responder" · "Deploy feito, falta você testar".',
    'Sem markdown, sem aspas, sem ponto final, sem detalhes técnicos.',
    '',
    '<resposta>',
    text,
    '</resposta>'
  ].join('\n')
  return askHaikuOneLine(request.cwd, prompt)
}

/** Haiku's first line for a flowchart card, stripped of quotes and trailing dots. */
async function askHaikuOneLine(
  cwd: string,
  prompt: string
): Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }> {
  const execution = runLocalSourceControlPlan({
    plan: {
      binary: 'claude',
      args: CLAUDE_SESSION_TITLE_ARGS,
      stdinPayload: prompt,
      label: 'Claude'
    },
    cwd: existsSync(cwd) ? cwd : process.cwd(),
    env: undefined,
    operation: 'session-title',
    spawnAgent: spawnSessionTitleAgent
  })
  const result = await execution.result
  if (!result.success) {
    return { kind: 'error', error: String(result.error) }
  }
  const summary = (result.rawOutput.trim().split(/\r?\n/u).find(Boolean) ?? '')
    .replace(/^["'“”*]+|["'“”*.]+$/gu, '')
    .trim()
  return summary ? { kind: 'ok', summary } : { kind: 'error', error: 'empty output' }
}

const EXECUTOR_NAME_MAX_INPUT = 1500

/** Fork: a short job title for an executor (two words) or planner (four) chat, shown on its flowchart card. */
export async function nameCanvasExecutor(request: {
  cwd: string
  text: string
  role?: 'executor' | 'planejador'
}): Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }> {
  const text = request.text.trim().slice(0, EXECUTOR_NAME_MAX_INPUT)
  if (!text) {
    return { kind: 'error', error: 'empty' }
  }
  const planner = request.role === 'planejador'
  const prompt = [
    planner
      ? 'Abaixo está a ordem dada a um planejador, um assistente que planeja e divide uma frente de trabalho.'
      : 'Abaixo está a ordem dada a um executor, um assistente de código que cumpre uma tarefa.',
    planner
      ? 'Dê a ele um título em português de NO MÁXIMO QUATRO palavras, claro, que diga o que ele planeja.'
      : 'Dê a ele um título de função em português, de UMA ou DUAS palavras, épico porém claro,',
    planner
      ? 'Exemplos do tom: Máscara de Carregamento · Etiquetas de Papel · Limpeza das Checagens.'
      : 'que diga o propósito dele. Exemplos do tom: Mestre UI/UX · Debugger · Implementador · Corretor · Validador · Criador de Testes.',
    'Responda só o título, sem aspas, sem ponto, sem explicação.',
    '',
    '<ordem>',
    text,
    '</ordem>'
  ].join('\n')
  return askHaikuOneLine(request.cwd, prompt)
}

export function registerPcDeskSessionTitleHandlers(): void {
  ipcMain.removeHandler('repos:summarizeCanvasReply')
  ipcMain.handle('repos:summarizeCanvasReply', (_event, request: { cwd: string; text: string }) =>
    summarizeCanvasReply(request)
  )
  ipcMain.removeHandler('repos:nameCanvasExecutor')
  ipcMain.handle(
    'repos:nameCanvasExecutor',
    (_event, request: { cwd: string; text: string; role?: 'executor' | 'planejador' }) =>
      nameCanvasExecutor(request)
  )
  ipcMain.removeHandler('repos:setPcDeskSmartTitles')
  ipcMain.handle('repos:setPcDeskSmartTitles', (_event, enabled: unknown) => {
    setPcDeskSmartTitlesPreferred(enabled === true)
  })
  ipcMain.handle('repos:suggestPcDeskSessionTitle', (_event, request: PcDeskSessionTitleRequest) =>
    suggestPcDeskSessionTitle(request)
  )
}
