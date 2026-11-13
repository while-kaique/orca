import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chatsSemVida, decidirEntrega, montarEstado } from './regras.mjs'

const CAMPOS = {
  objetivo: 'Botao de exportar',
  porque: 'A equipe pede o arquivo todo dia',
  criterios: ['Baixa um CSV'],
  limites: 'Nao mexer no login',
  territorio: 'src/'
}
const PO = { t: '2026-11-13T00:00:00.000Z', tipo: 'po_criado', chatId: 'PO' }
const ordemDe = (ordemId) => ({
  t: '2026-11-13T00:00:01.000Z',
  tipo: 'ordem_criada',
  ordemId,
  de: 'PO',
  para: 'executor',
  campos: CAMPOS
})
const lancado = (ordemId, chatId, handle, t) => ({
  t,
  tipo: 'chat_lancado',
  ordemId,
  chatId,
  handle,
  modelo: 'sonnet'
})

test('o-039 (13/11): chat lancado ha 10 s e fora da lista do Orca nao e dado como parado, nem 5 min depois', () => {
  const estado = montarEstado([
    PO,
    ordemDe('o-039'),
    lancado(
      'o-039',
      'cece1667-876b-43e0-83e6-ae4fbf79b02d',
      'term_9496fd87-61a9-4a13-baf4-0242761140da',
      '2026-11-13T03:58:08.917Z'
    )
  ])
  const horaDaMarca = Date.parse('2026-11-13T03:58:18.762Z')
  const primeira = chatsSemVida(estado, [], horaDaMarca)
  assert.deepEqual(primeira.mortos, [])
  const cincoMinDepois = horaDaMarca + 5 * 60000
  assert.deepEqual(chatsSemVida(estado, [], cincoMinDepois, primeira.semVidaDesde).mortos, [])
})

test('chat antigo sem terminal ou com terminal caido so vira parado depois de 2 min seguidos; terminal ligado nunca', () => {
  const estado = montarEstado([
    PO,
    ordemDe('o-1'),
    lancado('o-1', 'E1', 'term_1', '2026-11-13T00:00:02.000Z'),
    ordemDe('o-2'),
    lancado('o-2', 'E2', 'term_2', '2026-11-13T00:00:03.000Z'),
    ordemDe('o-3'),
    lancado('o-3', 'E3', 'term_3', '2026-11-13T00:00:04.000Z')
  ])
  const agora = Date.parse('2026-11-13T02:00:00.000Z')
  const terminais = [
    { tabId: 'E2', connected: false },
    { tabId: 'E3', connected: true, lastOutputAt: agora - 25 * 60000 }
  ]
  const primeira = chatsSemVida(estado, terminais, agora)
  assert.deepEqual(primeira.mortos, [])
  const quase = chatsSemVida(estado, terminais, agora + 119000, primeira.semVidaDesde)
  assert.deepEqual(quase.mortos, [])
  const fim = chatsSemVida(estado, terminais, agora + 120000, quase.semVidaDesde)
  assert.deepEqual(
    fim.mortos.map((morto) => morto.ordemId),
    ['o-1', 'o-2']
  )
})

test('ordem dada como parada pelo sistema aceita entrega do chat; baixa de quem criou, nao', () => {
  const eventos = [PO, ordemDe('o-1'), lancado('o-1', 'E1', 'term_1', '2026-11-13T00:00:02.000Z')]
  const provas = [{ caminho: 'p.md', existe: true }]
  const paradaPeloSistema = montarEstado([
    ...eventos,
    {
      tipo: 'parou_sem_entregar',
      ordemId: 'o-1',
      motivo: 'o chat nao tem terminal ligado (aba fechada ou dormindo)',
      automatico: true
    }
  ])
  assert.equal(
    decidirEntrega(paradaPeloSistema, { ordemId: 'o-1', por: 'E1', provas }).acao,
    'aceitar'
  )
  const baixaDeQuemCriou = montarEstado([
    ...eventos,
    { tipo: 'parou_sem_entregar', ordemId: 'o-1', por: 'PO', motivo: 'teste' }
  ])
  assert.equal(
    decidirEntrega(baixaDeQuemCriou, { ordemId: 'o-1', por: 'E1', provas }).acao,
    'recusar'
  )
})
