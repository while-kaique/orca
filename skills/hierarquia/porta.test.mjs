import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirOrdem, montarEstado } from './regras.mjs'
import { decidirPorta, lerTelaDoClaude, liberacaoAberta } from './regras-da-porta.mjs'

const CAMPOS = {
  objetivo: 'x',
  porque: 'y',
  criterios: ['z'],
  limites: 'w',
  territorio: 'v'
}

/** PO com dois executores trabalhando: o teto de executores está cheio. */
function tetoCheio() {
  return montarEstado([
    { t: '2026-11-13T10:00:00.000Z', tipo: 'po_criado', chatId: 'PO' },
    ...['e1', 'e2'].flatMap((id) => [
      {
        t: '2026-11-13T10:00:00.000Z',
        tipo: 'ordem_criada',
        ordemId: id,
        de: 'PO',
        para: 'executor',
        campos: CAMPOS
      },
      {
        t: '2026-11-13T10:00:00.000Z',
        tipo: 'chat_lancado',
        ordemId: id,
        chatId: id,
        modelo: 'sonnet'
      }
    ])
  ])
}

test('lancar e reabrir nunca juntos: com a liberacao aberta a ordem e recusada', () => {
  const estado = montarEstado([{ t: '2026-11-13T10:00:00.000Z', tipo: 'po_criado', chatId: 'PO' }])
  const liberacao = { desde: '2026-11-13T10:00:00.000Z', por: 'PO' }
  assert.equal(
    decidirOrdem(estado, { de: 'PO', para: 'planejador', campos: CAMPOS, liberacao }).acao,
    'recusar'
  )
  assert.equal(decidirOrdem(estado, { de: 'PO', para: 'planejador', campos: CAMPOS }).acao, 'criar')
})

test('a liberacao fecha quando o Orca reabre ou depois de 30 min', () => {
  const desde = Date.parse('2026-11-13T10:00:00.000Z')
  const liberacao = { desde: '2026-11-13T10:00:00.000Z' }
  assert.equal(liberacaoAberta(liberacao, desde + 29 * 60_000, desde - 1000), true)
  assert.equal(liberacaoAberta(liberacao, desde + 31 * 60_000, desde - 1000), false)
  assert.equal(liberacaoAberta(liberacao, desde + 60_000, desde + 30_000), false)
})

test('chat de teste nao disputa a vaga de executor e precisa do titulo TESTE', () => {
  const estado = tetoCheio()
  assert.equal(decidirOrdem(estado, { de: 'PO', para: 'executor', campos: CAMPOS }).acao, 'esperar')
  const teste = { ...CAMPOS, titulo: 'TESTE lancamento' }
  assert.equal(
    decidirOrdem(estado, { de: 'PO', para: 'executor', campos: teste, teste: true }).acao,
    'criar'
  )
  assert.equal(
    decidirOrdem(estado, { de: 'e1', para: 'executor', campos: teste, teste: true }).acao,
    'criar'
  )
  assert.equal(
    decidirOrdem(estado, { de: 'PO', para: 'executor', campos: CAMPOS, teste: true }).acao,
    'recusar'
  )
})

test('a porta so libera sem chat trabalhando e sem ordem recem-lancada', () => {
  assert.equal(decidirPorta({ trabalhando: [], recentes: [] }).pode, true)
  assert.equal(decidirPorta({ trabalhando: [{}], recentes: [] }).resumo, 'nao: 1 chat trabalhando')
  assert.equal(decidirPorta({ trabalhando: [], recentes: [{}] }).pode, false)
})

test('aviso so com o Claude aberto: shell sozinho nao conta como Claude', () => {
  const claude = ['texto', '──────────', '❯ ', '──────────', '  ⏵⏵ bypass permissions on · 1 shell']
  assert.deepEqual(lerTelaDoClaude(claude), { aberto: true, trabalhando: false, segundoPlano: 1 })
  assert.equal(lerTelaDoClaude(['PS C:\\Users\\User> ']).aberto, false)
  assert.equal(lerTelaDoClaude([...claude.slice(0, 4), 'PS C:\\Users\\User> ']).aberto, false)
})

test('o corte do X usa a lista que a pergunta mostrou (--porta-salva) e nao olha a porta de novo (prazo do X, 15/11)', async () => {
  const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { comandoPorta } = await import('./comandos-da-porta.mjs')
  const base = mkdtempSync(join(tmpdir(), 'corte-'))
  const projeto = join(base, 'projeto')
  mkdirSync(join(projeto, '.hierarquia'), { recursive: true })
  writeFileSync(join(projeto, '.hierarquia', 'registro.jsonl'), '')
  const salva = join(base, 'porta.json')
  writeFileSync(
    salva,
    JSON.stringify({
      pode: false,
      resumo: 'nao pode',
      recentes: [],
      chats: [
        { projeto, chatId: 'E1', ordemId: 'o-001', livre: false, segundoPlano: 0 },
        { projeto, chatId: 'L1', ordemId: null, livre: true, segundoPlano: 0 }
      ]
    })
  )
  const antes = { orca: process.env.HIERARQUIA_ORCA, indice: process.env.HIERARQUIA_INDICE }
  // Um Orca que nao existe: olhar a porta de novo falharia.
  process.env.HIERARQUIA_ORCA = join(base, 'nao-existe.cmd')
  process.env.HIERARQUIA_INDICE = join(base, 'indice.json')
  const escrever = console.log
  console.log = () => {}
  try {
    await comandoPorta({ 'registrar-corte': true, 'porta-salva': salva, json: true })
  } finally {
    console.log = escrever
    process.exitCode = 0
    for (const [nome, valor] of Object.entries({
      HIERARQUIA_ORCA: antes.orca,
      HIERARQUIA_INDICE: antes.indice
    })) {
      if (valor === undefined) {
        delete process.env[nome]
      } else {
        process.env[nome] = valor
      }
    }
  }
  const cortados = readFileSync(join(projeto, '.hierarquia', 'registro.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((e) => e.tipo === 'chat_cortado')
  assert.deepEqual(
    cortados.map((e) => [e.chatId, e.ordemId]),
    [['E1', 'o-001']]
  )
})
