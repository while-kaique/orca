import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { entregarGuardados } from './avisos-guardados.mjs'
import { escreverNoChat } from './orca-lancador.mjs'
import { lerEventos } from './registro.mjs'
import { montarEstado } from './regras.mjs'
import { cortadosDoVigia } from './volta-dos-cortados.mjs'
import { assinaturaDoCodigo } from './vigia-do-criador.mjs'

const CAMPOS = {
  objetivo: 'Rodar um sleep',
  porque: 'prova',
  criterios: ['ok'],
  limites: 'nada',
  territorio: 'nenhum'
}

/** Um Orca de mentira: o chat ABA existe; a tela mostra o Claude aberto ou so o shell; cada digitacao vai para um log. */
function orcaDeMentira(base) {
  const script = join(base, 'orca.mjs')
  writeFileSync(
    script,
    `import { appendFileSync, readFileSync } from 'node:fs'
const argv = process.argv.slice(2)
const ok = (result) => console.log(JSON.stringify({ ok: true, result }))
const claude = readFileSync(${JSON.stringify(join(base, 'claude.txt'))}, 'utf8').trim()
const LINHA = '${'─'.repeat(100)}'
if (argv[0] === 'terminal' && argv[1] === 'list') {
  ok({ terminals: [{ handle: 'term_aba', tabId: 'ABA', connected: true }] })
} else if (argv[0] === 'terminal' && argv[1] === 'read') {
  ok({ terminal: { tail: claude === 'aberto' ? ['ok', LINHA, '❯ ', LINHA, '  bypass'] : ['PS C:\\\\pasta>'] } })
} else if (argv[0] === 'terminal' && argv[1] === 'send') {
  if (argv.includes('--text')) {
    appendFileSync(${JSON.stringify(join(base, 'digitado.log'))}, argv[argv.indexOf('--text') + 1] + '\\n')
  }
  ok({})
} else {
  ok({})
}
`
  )
  const cmd = join(base, process.platform === 'win32' ? 'orca.cmd' : 'orca.sh')
  writeFileSync(
    cmd,
    process.platform === 'win32'
      ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`
      : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
    { mode: 0o755 }
  )
  return cmd
}

test('aviso guardado com o Claude fechado so e digitado quando o Claude abre, e uma vez so', async () => {
  const base = mkdtempSync(join(tmpdir(), 'avisos-'))
  const projeto = join(base, 'projeto')
  mkdirSync(join(projeto, '.hierarquia'), { recursive: true })
  const eventos = [
    { t: '2026-11-13T20:00:00.000Z', tipo: 'po_criado', chatId: 'ABA', handle: 'term_aba' },
    {
      t: '2026-11-13T20:01:00.000Z',
      tipo: 'aviso_guardado',
      avisoId: 'a-1',
      chatId: 'ABA',
      texto: 'PEDIDO FECHADO: teste'
    }
  ]
  writeFileSync(
    join(projeto, '.hierarquia', 'registro.jsonl'),
    `${eventos.map((e) => JSON.stringify(e)).join('\n')}\n`
  )
  const antes = process.env.HIERARQUIA_ORCA
  process.env.HIERARQUIA_ORCA = orcaDeMentira(base)
  try {
    writeFileSync(join(base, 'claude.txt'), 'fechado')
    await entregarGuardados(projeto, ['ABA'])
    assert.equal(existsSync(join(base, 'digitado.log')), false)
    writeFileSync(join(base, 'claude.txt'), 'aberto')
    await entregarGuardados(projeto, ['ABA'])
    await entregarGuardados(projeto, ['ABA'])
    assert.deepEqual(readFileSync(join(base, 'digitado.log'), 'utf8').trim().split('\n'), [
      'PEDIDO FECHADO: teste'
    ])
    assert.deepEqual(montarEstado(lerEventos(projeto)).guardados, {})
  } finally {
    if (antes === undefined) {
      delete process.env.HIERARQUIA_ORCA
    } else {
      process.env.HIERARQUIA_ORCA = antes
    }
  }
})

/**
 * Um Claude de mentira que trata texto e Enter chegando juntos como colagem: o texto fica na caixa e o Enter vira
 * quebra de linha. So o Enter sozinho envia. O `terminal read` devolve a caixa vazia na tela e o digitado em `draft`,
 * como o Orca faz.
 */
function claudeQueColaOEnter(base) {
  const script = join(base, 'orca.mjs')
  const caixa = join(base, 'caixa.txt')
  const enviados = join(base, 'enviados.log')
  writeFileSync(caixa, '')
  writeFileSync(
    script,
    `import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
const argv = process.argv.slice(2)
const ok = (result) => console.log(JSON.stringify({ ok: true, result }))
const LINHA = '${'─'.repeat(100)}'
const caixa = readFileSync(${JSON.stringify(caixa)}, 'utf8')
if (argv[0] === 'terminal' && argv[1] === 'read') {
  ok({ terminal: { tail: ['ok', LINHA, '❯ ', LINHA, '  bypass'], draft: caixa } })
} else if (argv[0] === 'terminal' && argv[1] === 'send') {
  const texto = argv.includes('--text') ? argv[argv.indexOf('--text') + 1] : ''
  if (texto) {
    writeFileSync(${JSON.stringify(caixa)}, caixa + texto + (argv.includes('--enter') ? ' ' : ''))
  } else if (argv.includes('--enter') && caixa.trim()) {
    appendFileSync(${JSON.stringify(enviados)}, caixa.trim() + '\\n')
    writeFileSync(${JSON.stringify(caixa)}, '')
  }
  ok({})
} else {
  ok({})
}
`
  )
  const cmd = join(base, process.platform === 'win32' ? 'orca.cmd' : 'orca.sh')
  writeFileSync(
    cmd,
    process.platform === 'win32'
      ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`
      : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
    { mode: 0o755 }
  )
  return { cmd, caixa, enviados }
}

test('aviso num chat em que texto e Enter juntos viram colagem: o Enter vai sozinho e o aviso sai da caixa (13/11)', async () => {
  const base = mkdtempSync(join(tmpdir(), 'enter-'))
  const { cmd, caixa, enviados } = claudeQueColaOEnter(base)
  const antes = { orca: process.env.HIERARQUIA_ORCA, ms: process.env.HIERARQUIA_ENTER_MS }
  process.env.HIERARQUIA_ORCA = cmd
  process.env.HIERARQUIA_ENTER_MS = '200'
  try {
    assert.equal(await escreverNoChat('term_aba', 'AVISO DA HIERARQUIA: pedido fechado'), true)
    assert.equal(readFileSync(caixa, 'utf8'), '')
    assert.deepEqual(readFileSync(enviados, 'utf8').trim().split('\n'), [
      'AVISO DA HIERARQUIA: pedido fechado'
    ])
  } finally {
    for (const [nome, valor] of [
      ['HIERARQUIA_ORCA', antes.orca],
      ['HIERARQUIA_ENTER_MS', antes.ms]
    ]) {
      if (valor === undefined) {
        delete process.env[nome]
      } else {
        process.env[nome] = valor
      }
    }
  }
})

test('o vigia percebe codigo novo: a assinatura muda quando um .mjs da hierarquia muda', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'codigo-'))
  writeFileSync(join(pasta, 'regras.mjs'), 'export const a = 1\n')
  const antes = assinaturaDoCodigo(pasta)
  writeFileSync(join(pasta, 'regras.mjs'), 'export const a = 22\n')
  assert.notEqual(assinaturaDoCodigo(pasta), antes)
  writeFileSync(join(pasta, 'notas.txt'), 'nao e codigo')
  assert.equal(assinaturaDoCodigo(pasta), assinaturaDoCodigo(pasta))
})

test('a volta respeita o teto: so voltam chats cortados de ordens que ja ocupam vaga (2 executores), nunca a terceira', () => {
  let s = 0
  const ev = (tipo, dados) => ({
    t: new Date(Date.UTC(2026, 10, 13, 20, 0, s++)).toISOString(),
    tipo,
    ...dados
  })
  const eventos = [ev('po_criado', { chatId: 'PO' })]
  for (const n of [1, 2, 3]) {
    eventos.push(
      ev('ordem_criada', {
        ordemId: `o-${n}`,
        de: 'PO',
        para: 'executor',
        campos: CAMPOS,
        ...(n === 3 ? { emEspera: true } : {})
      })
    )
  }
  for (const n of [1, 2]) {
    eventos.push(ev('chat_lancado', { ordemId: `o-${n}`, chatId: `E${n}`, modelo: 'sonnet' }))
    eventos.push(ev('chat_cortado', { ordemId: `o-${n}`, chatId: `E${n}`, motivo: 'X' }))
  }
  const estado = montarEstado(eventos)
  assert.equal(estado.ordens['o-3'].situacao, 'em_espera')
  assert.deepEqual(
    cortadosDoVigia(estado, 'PO').map(({ ordem }) => ordem.id),
    ['o-1', 'o-2']
  )
})
