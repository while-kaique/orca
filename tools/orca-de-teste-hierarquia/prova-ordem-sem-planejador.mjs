// Prova das partes 1 e 3 do o-047 com o Orca simulado (nenhum chat de verdade): a linha do worker-start de um executor
// real (sonnet, high), a linha acrescentada aos limites, o teto de 4 e a recusa de planejador.
// Uso: node tools/orca-de-teste-hierarquia/prova-ordem-sem-planejador.mjs PASTA_DE_SAIDA
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const HIERARQUIA = path.join(RAIZ, 'skills', 'hierarquia', 'hierarquia.mjs')
const saida = path.resolve(process.argv[2] ?? 'prova-ordem')
mkdirSync(saida, { recursive: true })
const base = mkdtempSync(path.join(tmpdir(), 'prova-ordem-'))
const projeto = path.join(base, 'projeto')
mkdirSync(path.join(projeto, '.hierarquia', 'ordens'), { recursive: true })
writeFileSync(
  path.join(projeto, '.hierarquia', 'registro.jsonl'),
  `${JSON.stringify({ t: '2026-11-16T00:00:00.000Z', tipo: 'po_criado', chatId: 'aba-po', handle: 'term_po' })}\n`
)
writeFileSync(
  path.join(projeto, '.hierarquia', 'config.json'),
  JSON.stringify({ pastaDosChats: 'projeto' })
)
const orca = path.join(base, 'orca.cmd')
writeFileSync(
  orca,
  `@echo off\r\n"${process.execPath}" "${path.join(RAIZ, 'skills', 'hierarquia', 'orca-simulado.mjs')}" %*\r\n`
)
const env = {
  ...process.env,
  HIERARQUIA_PROJETO: projeto,
  HIERARQUIA_ORCA: orca,
  HIERARQUIA_INDICE: path.join(base, 'indice.json'),
  HIERARQUIA_ENTER_MS: '300',
  ORCA_SIMULADO_DIR: path.join(base, 'orca-simulado'),
  ORCA_SIMULADO_MODO: 'aceita:1',
  ORCA_TAB_ID: 'aba-po',
  ORCA_TERMINAL_HANDLE: 'term_po'
}
const rodar = (args) =>
  spawnSync(process.execPath, [HIERARQUIA, ...args], {
    env,
    cwd: projeto,
    encoding: 'utf8',
    timeout: 120_000
  })
const relato = []
const dizer = (texto) => {
  relato.push(texto)
  console.log(texto)
}
const ordemJson = path.join(base, 'ordem.json')
writeFileSync(
  ordemJson,
  JSON.stringify({
    objetivo: 'Prova do comando',
    porque: 'Conferir a linha do worker-start',
    criterios: ['a linha tem --model e --effort'],
    limites: 'Nao mexer no login',
    territorio: 'nenhum'
  })
)
const pidsDeVigias = []
try {
  const planejador = rodar(['ordem', '--para', 'planejador', '--arquivo', ordemJson])
  dizer(
    `== hierarquia ordem --para planejador (saida ${planejador.status})\n${planejador.stderr}${planejador.stdout}`
  )

  const primeira = rodar(['ordem', '--para', 'executor', '--arquivo', ordemJson])
  dizer(
    `== hierarquia ordem --para executor (saida ${primeira.status})\n${primeira.stderr
      .split('\n')
      .filter((l) => !l.includes('Deprecation') && !l.includes('trace-deprecation'))
      .join('\n')}${primeira.stdout}`
  )
  const limites = readFileSync(path.join(projeto, '.hierarquia', 'ordens', 'o-001.md'), 'utf8')
  dizer(
    `== arquivo da ordem, secao Limites\n${limites.slice(limites.indexOf('## Limites'), limites.indexOf('## Território'))}`
  )
  const chamadas = readFileSync(path.join(base, 'orca-simulado', 'chamadas.log'), 'utf8')
  const linha = chamadas.split('\n').find((l) => l.includes('worker-start')) ?? 'SEM worker-start'
  dizer(
    `== linha do worker-start (executor real, pedido abreviado)\n${linha.replace(/--spec .*? --task-title/u, '--spec <pedido> --task-title')}`
  )

  for (let n = 2; n <= 5; n++) {
    const r = rodar(['ordem', '--para', 'executor', '--arquivo', ordemJson])
    dizer(`ordem ${n}: ${r.stdout.trim().split('\n').pop()}`)
  }
  const estado = rodar(['estado'])
  dizer(
    `== hierarquia estado (linha do teto)\n${estado.stdout
      .split('\n')
      .filter((l) => l.startsWith('Teto'))
      .join('\n')}`
  )
} finally {
  try {
    const vigia = JSON.parse(
      readFileSync(path.join(projeto, '.hierarquia', 'vigias', 'aba-po.json'), 'utf8')
    )
    pidsDeVigias.push(vigia.pid)
  } catch {
    // sem vigia
  }
  for (const pid of pidsDeVigias) {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true })
  }
  writeFileSync(path.join(saida, 'prova.txt'), `${relato.join('\n\n')}\n`)
  rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
