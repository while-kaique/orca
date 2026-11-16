import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarEstado, podeCuidarDaOrdem } from './regras.mjs'

const CAMPOS = {
  objetivo: 'Botao de exportar',
  porque: 'A equipe pede o arquivo todo dia',
  criterios: ['Baixa um CSV'],
  limites: 'Nao mexer no login',
  territorio: 'src/'
}
let relogio = 0
const ev = (tipo, dados) => ({
  t: new Date(Date.UTC(2026, 10, 13, 12, 0, relogio++)).toISOString(),
  tipo,
  ...dados
})

// Caso real de 13/11: o PO antigo 105f deu a o-014; o PO 8474 assumiu; o planejador 6230 deu a o-036 e caiu no
// reinicio (aba fechada); o planejador vivo 312a deu a o-050.
const estado = montarEstado([
  ev('po_criado', { chatId: '105f' }),
  ev('ordem_criada', { ordemId: 'o-014', de: '105f', para: 'executor', campos: CAMPOS }),
  ev('chat_lancado', { ordemId: 'o-014', chatId: 'c967', modelo: 'sonnet' }),
  ev('po_criado', { chatId: '8474' }),
  ev('ordem_criada', { ordemId: 'o-034', de: '8474', para: 'planejador', campos: CAMPOS }),
  ev('chat_lancado', { ordemId: 'o-034', chatId: '6230', modelo: 'opus' }),
  ev('ordem_criada', { ordemId: 'o-036', de: '6230', para: 'executor', campos: CAMPOS }),
  ev('chat_lancado', { ordemId: 'o-036', chatId: '933f', modelo: 'sonnet' }),
  ev('chat_encerrado', { chatId: '6230', motivo: 'aba fechada' }),
  ev('ordem_criada', { ordemId: 'o-042', de: '8474', para: 'planejador', campos: CAMPOS }),
  ev('chat_lancado', { ordemId: 'o-042', chatId: '312a', modelo: 'opus' }),
  ev('ordem_criada', { ordemId: 'o-050', de: '312a', para: 'executor', campos: CAMPOS }),
  ev('chat_lancado', { ordemId: 'o-050', chatId: 'e050', modelo: 'sonnet' })
])

test('o PO atual herda a ordem de um PO antigo e a de um planejador que caiu', () => {
  assert.equal(podeCuidarDaOrdem(estado, '8474', estado.ordens['o-014']), true)
  assert.equal(podeCuidarDaOrdem(estado, '8474', estado.ordens['o-036']), true)
})

test('com o criador vivo, so ele cuida da ordem; e ninguem alem do PO atual herda', () => {
  assert.equal(podeCuidarDaOrdem(estado, '8474', estado.ordens['o-050']), false)
  assert.equal(podeCuidarDaOrdem(estado, '312a', estado.ordens['o-050']), true)
  assert.equal(podeCuidarDaOrdem(estado, '312a', estado.ordens['o-036']), false)
  assert.equal(podeCuidarDaOrdem(estado, '105f', estado.ordens['o-036']), false)
})

test('criador com a aba fechada (sem registro de encerrado) tambem passa a ordem ao PO atual', () => {
  const vidas = new Map([['312a', 'fechado']])
  assert.equal(podeCuidarDaOrdem(estado, '8474', estado.ordens['o-050'], vidas), true)
})
