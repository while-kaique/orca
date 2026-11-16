import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chatsEsperandoFechar, linhasEsperandoFechar } from './esperando-fechar.mjs'
import { montarEstado } from './regras.mjs'

const CAMPOS = {
  titulo: 'Botao de exportar',
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

// O PO deu o-1 (entregue e aprovada) e o-2 a um planejador P2, que criou o-3; P2 fechou e o-3 parou sozinha.
const eventos = [
  ev('po_criado', { chatId: 'PO' }),
  ev('ordem_criada', { ordemId: 'o-1', de: 'PO', para: 'executor', campos: CAMPOS, pedido: 'X' }),
  ev('chat_lancado', { ordemId: 'o-1', chatId: 'E1', modelo: 'sonnet' }),
  ev('entrega', { ordemId: 'o-1', portao: 'produto', provas: ['ok.txt'] }),
  ev('conferencia', { ordemId: 'o-1', por: 'PO', aprovada: true }),
  ev('ordem_criada', { ordemId: 'o-2', de: 'PO', para: 'planejador', campos: CAMPOS, pedido: 'J' }),
  ev('chat_lancado', { ordemId: 'o-2', chatId: 'P2', modelo: 'opus' }),
  ev('ordem_criada', { ordemId: 'o-3', de: 'P2', para: 'executor', campos: CAMPOS }),
  ev('chat_lancado', { ordemId: 'o-3', chatId: 'E3', modelo: 'sonnet' }),
  ev('parou_sem_entregar', { ordemId: 'o-3', motivo: 'chat caiu', automatico: true }),
  ev('chat_encerrado', { chatId: 'P2', motivo: 'aba fechada' })
]
const vidas = new Map([
  ['PO', 'ligado'],
  ['E1', 'dormindo'],
  ['P2', 'fechado'],
  ['E3', 'dormindo']
])

test('o estado lista o chat de pedido entregue e o parado cujo criador caiu, com a frase para o PO', () => {
  const linhas = linhasEsperandoFechar(chatsEsperandoFechar(montarEstado(eventos), vidas))
  assert.equal(
    linhas[0],
    'ESPERANDO O KAIQUE CONFIRMAR O FECHAMENTO (2 chat(s)); pergunte em TODA mensagem ate ele responder:'
  )
  assert.equal(linhas[1], '  * pedido entregue: o-1 (executor, aprovado): Botao de exportar')
  assert.equal(linhas[2], '  * parado, criador caiu: o-3 (executor, parou): Botao de exportar')
  assert.equal(
    linhas[3],
    '  Frase para repetir: "Kaique, estes chats terminaram o seu objetivo e estao esperando ser fechados: o-1 (Botao de exportar). E estes pararam e quem os criou ja fechou: o-3 (Botao de exportar). Posso fechar, ou voce fecha?"'
  )
})

test('a linha some quando a aba do chat fecha, e nao antes (registro "encerrado" com o card na tela ainda conta)', () => {
  const encerrados = [
    ...eventos,
    ev('chat_encerrado', { chatId: 'E1', motivo: 'deu lugar a outro chat' })
  ]
  const comCard = chatsEsperandoFechar(montarEstado(encerrados), vidas)
  assert.deepEqual(
    comCard.entregues.map((ordem) => ordem.id),
    ['o-1']
  )
  const semAbas = new Map([...vidas, ['E1', 'fechado'], ['E3', 'fechado']])
  assert.deepEqual(linhasEsperandoFechar(chatsEsperandoFechar(montarEstado(eventos), semAbas)), [])
})

test('chat trabalhando, ou parado com o criador vivo, nao entra na linha', () => {
  const vivo = new Map([...vidas, ['P2', 'ligado']])
  const semEncerrarP2 = eventos.filter((e) => !(e.tipo === 'chat_encerrado' && e.chatId === 'P2'))
  const { orfaos } = chatsEsperandoFechar(montarEstado(semEncerrarP2), vivo)
  assert.deepEqual(orfaos, [])
})
