#!/usr/bin/env node
// Orca simulado para testar o comando `hierarquia` sem abrir chat de verdade (HIERARQUIA_ORCA aponta para ele).
// Cada chamada é um processo novo: o estado vive em ORCA_SIMULADO_DIR/estado.json e toda chamada fica em chamadas.log.
// ORCA_SIMULADO_MODO: "nunca" (o Enter nunca é aceito) ou "aceita:N" (o chat começa no N-ésimo envio).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pasta = process.env.ORCA_SIMULADO_DIR
mkdirSync(pasta, { recursive: true })
const arquivoDeEstado = join(pasta, 'estado.json')
const argv = process.argv.slice(2).filter((arg) => arg !== '--json')
appendFileSync(join(pasta, 'chamadas.log'), `${new Date().toISOString()} ${argv.join(' ')}\n`)

const estado = existsSync(arquivoDeEstado)
  ? JSON.parse(readFileSync(arquivoDeEstado, 'utf8'))
  : { nascido: false, envios: 0, comecou: false, spec: '' }
const gravar = () => writeFileSync(arquivoDeEstado, JSON.stringify(estado))
const responder = (result = {}) => console.log(JSON.stringify({ ok: true, result }))
const valorDe = (nome) => argv[argv.indexOf(nome) + 1]
const [grupo, verbo] = argv
const LINHA = '─'.repeat(112)
const TELA_VAZIA = [
  ' ▐▛███▛█   Claude Code v2.1.323',
  '▝▜██████▀  Sonnet 5.5 with high effort · Claude Team',
  ' ▝▝   ▝▝   ~\\orca\\workspaces\\orca\\ropefish · /rc',
  LINHA,
  '❯',
  LINHA,
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'
]
const TERMINAL = {
  handle: 'term_simulado-0001',
  tabId: 'aba-simulada-0001',
  connected: true,
  agentIdentity: 'claude',
  worktreePath: 'C:/simulado/pasta-do-chat'
}
const CRIADOR = {
  handle: process.env.ORCA_TERMINAL_HANDLE,
  tabId: process.env.ORCA_TAB_ID,
  connected: true,
  agentIdentity: 'claude'
}

if (grupo === 'orchestration' && verbo === 'worker-start') {
  estado.nascido = true
  estado.spec = valorDe('--spec') ?? ''
  estado.titulo = valorDe('--task-title') ?? ''
  gravar()
  // O Orca real demora a devolver: dá tempo de o comando reconhecer a aba nova enquanto espera.
  await new Promise((pronto) => setTimeout(pronto, 3000))
  responder({
    state: 'outcome_unknown',
    stage: 'turn_start_unobserved',
    dispatchId: 'ctx_simulado',
    taskId: 'task_simulada',
    terminal: TERMINAL.handle,
    workspace: 'id::C:/simulado/pasta-do-chat'
  })
} else if (grupo === 'orchestration' && verbo === 'task-list') {
  responder({
    tasks: estado.nascido
      ? [
          {
            id: 'task_simulada',
            title: estado.titulo,
            dispatchId: 'ctx_simulado',
            assignee: TERMINAL.handle
          }
        ]
      : []
  })
} else if (grupo === 'terminal' && verbo === 'list') {
  responder({ terminals: [CRIADOR, ...(estado.nascido ? [TERMINAL] : [])] })
} else if (grupo === 'terminal' && verbo === 'show') {
  responder({ terminal: { ...TERMINAL } })
} else if (grupo === 'terminal' && verbo === 'read') {
  const texto = `=== TASK ===\n${estado.spec}`
  responder({
    terminal: {
      handle: TERMINAL.handle,
      status: 'running',
      tail: estado.comecou
        ? [` ❯ ${estado.spec.slice(0, 200)}`, '● lendo o papel', LINHA, '❯', LINHA]
        : TELA_VAZIA,
      source: 'screen',
      draft: estado.comecou ? '' : texto.slice(-1100)
    }
  })
} else if (grupo === 'terminal' && verbo === 'send') {
  estado.envios += 1
  const modo = process.env.ORCA_SIMULADO_MODO ?? 'nunca'
  if (modo.startsWith('aceita:') && estado.envios >= Number(modo.split(':')[1])) {
    estado.comecou = true
  }
  gravar()
  responder({ accepted: true })
} else if (grupo === 'orchestration' && verbo === 'worker-show') {
  responder({ projection: { stage: { activity: estado.comecou ? 'working' : 'done' } } })
} else if (grupo === 'orchestration' && verbo === 'run-current') {
  responder({ runId: 'run_simulado' })
} else if (grupo === 'orchestration' && verbo === 'check') {
  await new Promise((pronto) => setTimeout(pronto, 3000))
  responder({ messages: [] })
} else {
  responder({})
}
