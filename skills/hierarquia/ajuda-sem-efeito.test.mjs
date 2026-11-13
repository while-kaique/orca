import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const AQUI = import.meta.dirname

function montarProjeto() {
  const base = mkdtempSync(join(tmpdir(), 'ajuda-hierarquia-'))
  const projeto = join(base, 'projeto')
  mkdirSync(join(projeto, '.hierarquia', 'ordens'), { recursive: true })
  writeFileSync(
    join(projeto, '.hierarquia', 'registro.jsonl'),
    `${JSON.stringify({ t: '2026-11-13T00:00:00.000Z', tipo: 'po_criado', chatId: 'aba-po', handle: 'term_antigo' })}\n`
  )
  const orca = join(base, process.platform === 'win32' ? 'orca.cmd' : 'orca.sh')
  const simulado = join(AQUI, 'orca-simulado.mjs')
  writeFileSync(
    orca,
    process.platform === 'win32'
      ? `@echo off\r\nnode "${simulado}" %*\r\n`
      : `#!/bin/sh\nexec node "${simulado}" "$@"\n`,
    { mode: 0o755 }
  )
  return { base, projeto, orca }
}

test('--help e campo obrigatorio faltando nao gravam no registro nem falam com chat nenhum', () => {
  const { base, projeto, orca } = montarProjeto()
  const registro = join(projeto, '.hierarquia', 'registro.jsonl')
  const antes = readFileSync(registro)
  const env = {
    ...process.env,
    HIERARQUIA_PROJETO: projeto,
    HIERARQUIA_ORCA: orca,
    ORCA_SIMULADO_DIR: join(base, 'orca-simulado'),
    ORCA_TAB_ID: 'aba-po',
    // Terminal diferente do registrado: sem a conferencia previa, o comando anotaria chat_reconectado.
    ORCA_TERMINAL_HANDLE: 'term_novo'
  }
  const linhas = [
    ['perguntar', '--help'],
    ['perguntar'],
    ['responder', '--help'],
    ['responder'],
    ['responder', '--pergunta', 'p-001'],
    ['ordem', '--help'],
    ['ordem'],
    ['ordem', '--para', 'executor']
  ]
  try {
    for (const linha of linhas) {
      const saida = spawnSync(process.execPath, [join(AQUI, 'hierarquia.mjs'), ...linha], {
        env,
        encoding: 'utf8'
      })
      const pedidoDeAjuda = linha.includes('--help')
      assert.equal(saida.status, pedidoDeAjuda ? 0 : 1, linha.join(' '))
      assert.match(saida.stderr, pedidoDeAjuda ? /^hierarquia /u : /^Falta --/u, linha.join(' '))
      assert.deepEqual(readFileSync(registro), antes, linha.join(' '))
    }
    assert.equal(existsSync(join(base, 'orca-simulado', 'chamadas.log')), false)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
