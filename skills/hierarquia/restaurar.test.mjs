import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decidirRestauracao } from './decisao-de-restauracao.mjs'
import { criadorSumiu, montarEstado } from './regras.mjs'

// O registro real do social-hub em 16/11, ate a queda (antes da restauracao a mao), com os textos das ordens trocados por marcadores.
const REAL = readFileSync(
  join(import.meta.dirname, 'fixtures', 'registro-social-hub-16-11-antes-da-restauracao.jsonl'),
  'utf8'
)
  .split('\n')
  .filter(Boolean)
  .map((linha) => JSON.parse(linha))

const PO_ANTIGO = '0072e90f-16a8-4aaf-b697-814462713605'
const O023_ANTIGO = 'b4cc54bb-fb23-429f-a541-8b84c23044c5'
const PO_NOVO = '7d16077c-1cc7-4b5a-a348-cdd0dd1497fe'
const O023_NOVO = '445cfbb8-0514-48c2-802a-4462bc83682b'
const restaurado = (chatAnterior, chatId, t) => ({
  t,
  tipo: 'chat_restaurado',
  chatAnterior,
  chatId,
  handle: `term_${chatId.slice(0, 8)}`,
  conversa: 'e2a4ea02-123e-404d-aa96-2e68eacb3640'
})

test('registro real do social-hub (16/11): PO e o-023 voltam em aba nova e herdam o lugar, filhos e a situacao das ordens', () => {
  const antes = montarEstado(REAL)
  assert.equal(antes.po, PO_ANTIGO)
  assert.deepEqual(
    ['o-019', 'o-024', 'o-025'].map((id) => antes.ordens[id].situacao),
    ['aprovado', 'aprovado', 'aprovado']
  )

  const estado = montarEstado([
    ...REAL,
    restaurado(PO_ANTIGO, PO_NOVO, '2026-11-16T16:41:00.000Z'),
    restaurado(O023_ANTIGO, O023_NOVO, '2026-11-16T16:42:00.000Z')
  ])

  assert.equal(estado.po, PO_NOVO)
  assert.equal(estado.chats[PO_NOVO].papel, 'po')
  assert.equal(estado.chats[PO_ANTIGO].ativo, false)

  assert.equal(estado.chats[O023_NOVO].papel, 'planejador')
  assert.equal(estado.chats[O023_NOVO].pai, PO_NOVO)
  assert.equal(estado.chats[O023_NOVO].ordemId, 'o-023')
  assert.equal(estado.ordens['o-023'].chatId, O023_NOVO)
  assert.equal(estado.ordens['o-023'].situacao, 'trabalhando')
  assert.equal(estado.chats[O023_ANTIGO].ativo, false)

  for (const id of ['o-024', 'o-025']) {
    assert.equal(estado.ordens[id].de, O023_NOVO)
    assert.equal(estado.chats[estado.ordens[id].chatId].pai, O023_NOVO)
    assert.equal(criadorSumiu(estado, estado.ordens[id]), false)
  }
  assert.equal(estado.ordens['o-019'].de, PO_NOVO)
  assert.deepEqual(
    ['o-019', 'o-024', 'o-025'].map((id) => estado.ordens[id].situacao),
    ['aprovado', 'aprovado', 'aprovado']
  )
})

test('restaurar: so o PO atual restaura filho; PO morto volta por qualquer chat; chat ligado nao se restaura', () => {
  const estado = montarEstado(REAL)
  assert.equal(
    decidirRestauracao(estado, { eu: PO_ANTIGO, chatAnterior: O023_ANTIGO, vida: 'fechado' })
      .modelo,
    'opus'
  )
  assert.equal(
    decidirRestauracao(estado, { eu: 'intruso', chatAnterior: O023_ANTIGO, vida: 'fechado' }).acao,
    'recusar'
  )
  assert.equal(
    decidirRestauracao(estado, { eu: 'qualquer', chatAnterior: PO_ANTIGO, vida: 'dormindo' }).acao,
    'restaurar'
  )
  assert.equal(
    decidirRestauracao(estado, { eu: PO_ANTIGO, chatAnterior: O023_ANTIGO, vida: 'ligado' }).acao,
    'recusar'
  )
  assert.equal(
    decidirRestauracao(estado, { eu: 'x', chatAnterior: 'nao-existe', vida: 'fechado' }).acao,
    'recusar'
  )
})
