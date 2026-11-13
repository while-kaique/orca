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
