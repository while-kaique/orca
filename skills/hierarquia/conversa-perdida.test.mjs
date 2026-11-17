import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decidirEscondidos } from './chats-escondidos.mjs'
import {
  acharConversa,
  ordensComConversaPerdida,
  pastaDasConversas,
  textoDaConversaPerdida
} from './conversa-perdida.mjs'
import { montarEstado } from './regras.mjs'

const CAMPOS = {
  titulo: 'TESTE fato: comando longo',
  objetivo: 'Rodar um sleep',
  porque: 'prova',
  criterios: ['ok'],
  limites: 'nada',
  territorio: 'nenhum'
}
const T0 = Date.parse('2026-11-13T20:00:00.000Z')
const ev = (s, tipo, dados) => ({ t: new Date(T0 + s * 1000).toISOString(), tipo, ...dados })
const eventos = [
  ev(0, 'po_criado', { chatId: 'PO' }),
  ev(1, 'ordem_criada', { ordemId: 'o-001', de: 'PO', para: 'executor', campos: CAMPOS }),
  ev(2, 'chat_lancado', {
    ordemId: 'o-001',
    chatId: 'aba-longo',
    dispatchId: 'ctx_eb8434cc7dfe',
    pasta: 'C:/mundo/projetos/teste-hierarquia',
    modelo: 'haiku'
  }),
  ev(600, 'parou_sem_entregar', {
    ordemId: 'o-001',
    motivo: 'o chat nao tem terminal ligado (aba fechada ou dormindo)',
    automatico: true
  })
]
const vidas = new Map([
  ['PO', 'ligado'],
  ['aba-longo', 'fechado']
])

test('a conversa do chat perdido e achada pelo dispatchId na pasta de conversas do Claude', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'conversas-'))
  assert.equal(
    pastaDasConversas('C:/mundo/projetos/teste-hierarquia', raiz),
    join(raiz, 'C--mundo-projetos-teste-hierarquia')
  )
  const dir = pastaDasConversas('C:/mundo/projetos/teste-hierarquia', raiz)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'outra-conversa.jsonl'), '{"type":"user","text":"nada a ver"}\n')
  writeFileSync(
    join(dir, '60c11c03-af51.jsonl'),
    '{"type":"user","text":"dispatch ctx_eb8434cc7dfe"}\n'
  )
  assert.deepEqual(
    acharConversa({
      pasta: 'C:/mundo/projetos/teste-hierarquia',
      dispatchId: 'ctx_eb8434cc7dfe',
      raiz
    })?.sessao,
    '60c11c03-af51'
  )
})

test('chat que sumiu gera UM aviso a quem criou, com o comando para retomar a conversa', () => {
  const estado = montarEstado(eventos)
  const agora = T0 + 700_000
  assert.deepEqual(
    ordensComConversaPerdida(estado, 'PO', vidas, agora).map((o) => o.id),
    ['o-001']
  )
  assert.equal(
    textoDaConversaPerdida(estado.ordens['o-001'], { sessao: '60c11c03-af51' }),
    'CHAT PERDIDO: o chat da ordem o-001 (TESTE fato: comando longo) sumiu quando o Orca fechou ou caiu, e a aba nao voltou. A ordem foi dada como parada. A conversa dele esta guardada: para retomar, abra um terminal na pasta C:/mundo/projetos/teste-hierarquia e rode: claude --resume 60c11c03-af51.'
  )
  const avisado = montarEstado([
    ...eventos,
    ev(650, 'conversa_perdida_avisada', { ordemId: 'o-001', sessao: '60c11c03-af51' })
  ])
  assert.deepEqual(ordensComConversaPerdida(avisado, 'PO', vidas, agora), [])
  assert.deepEqual(
    ordensComConversaPerdida(estado, 'PO', new Map([...vidas, ['aba-longo', 'dormindo']]), agora),
    []
  )
})

test('chat escondido encerrado ao reabrir: ordem da hierarquia para; chat livre vai para o aviso do PO', () => {
  const estado = montarEstado(eventos.slice(0, 3))
  const { paradas, livres } = decidirEscondidos(
    [{ projeto: 'C:/mundo/projetos/teste-hierarquia', estado }],
    [
      { tabId: 'aba-longo', cwd: 'C:/mundo/projetos/teste-hierarquia' },
      { tabId: 'aba-livre', cwd: 'C:/mundo/projetos/teste-hierarquia-2' }
    ]
  )
  assert.deepEqual(paradas, [
    { projeto: 'C:/mundo/projetos/teste-hierarquia', ordemId: 'o-001', chatId: 'aba-longo' }
  ])
  assert.deepEqual(
    livres.map((s) => s.tabId),
    ['aba-livre']
  )
})
