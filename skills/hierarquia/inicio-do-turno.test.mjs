import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirInicio, ondeEstaAOrdem } from './regras.mjs'

const LINHA = '─'.repeat(112)
const BASE = { naCaixaDesde: null, tentouEnviarEm: null, enviadaEm: null, comecouEm: null }
const TRECHOS = [
  'ORDEM o-033 (executor). PAPEL: executor ',
  'e so depois envie worker_done como manda o seu preambulo.'
]

// Valores do chat real da o-033 (terminal read em 12/11 21:30): caixa vazia na tela, ordem no rascunho.
const TELA_DA_O033 = [
  ' ▐▛███▛█   Claude Code v2.1.323',
  '▝▜██████▀  Sonnet 5.5 with high effort · Claude Team',
  ' ▝▝   ▝▝   ~\\orca\\workspaces\\orca\\ropefish · /rc',
  LINHA,
  '❯',
  LINHA,
  '  ⏵⏵ bypass permissions on (shift+tab to cycle)'
]
const RASCUNHO_DA_O033 =
  'nts: os limites escritos na ordem e as\nproibicoes do seu papel. Ownership: somente o territorio escrito na ordem. Observable acceptance: produza a prova\npedida nos criterios, rode: hierarquia entregar --ordem o-033 --prova CAMINHO_DA_PROVA (uma opcao --prova por\narquivo), e so depois envie worker_done como manda o seu preambulo.'

test('o-033: rascunho com a ordem e atividade done nao e "comecou": a ordem esta parada e o comando envia', () => {
  const onde = ondeEstaAOrdem(TELA_DA_O033, RASCUNHO_DA_O033, TRECHOS)
  assert.equal(onde, 'na_caixa')
  const primeiro = decidirInicio(BASE, { atividade: 'done', onde }, 1000)
  assert.equal(primeiro.acao, 'esperar')
  assert.equal(decidirInicio(primeiro.vigia, { atividade: 'done', onde }, 5200).acao, 'enviar')
})

test('rascunho "[Pasted text #1]" (ordem longa colada) tambem e ordem parada', () => {
  assert.equal(ondeEstaAOrdem(TELA_DA_O033, '[Pasted text #1]', TRECHOS), 'na_caixa')
  assert.equal(ondeEstaAOrdem(TELA_DA_O033, 'qualquer outra coisa', TRECHOS), 'ausente')
})

test('chat ocioso sem a ordem na conversa e sem rascunho nunca vira "comecou"', () => {
  const onde = ondeEstaAOrdem(TELA_DA_O033, undefined, TRECHOS)
  assert.equal(onde, 'ausente')
  assert.equal(decidirInicio(BASE, { atividade: 'done', onde }, 9000).acao, 'esperar')
})

test('a ordem ja na conversa vale mais que o rascunho', () => {
  const conversa = [
    '❯ ORDEM o-033 (executor). PAPEL: executor na hierarquia',
    '● lendo o papel',
    LINHA,
    '❯',
    LINHA
  ]
  assert.equal(ondeEstaAOrdem(conversa, RASCUNHO_DA_O033, TRECHOS), 'no_historico')
})

// Caso de 13/11 (o-034), reconstruido da leitura do PO em DECISOES.md (o rascunho exato nao foi guardado):
// mesma tela vazia, ordem do planejador inteira no rascunho, atividade done, chat novo.
const TRECHOS_DA_O034 = [
  'ORDEM o-034 (planejador). PAPEL: planeja',
  ' worker_done como manda o seu preambulo.'
]
const RASCUNHO_DA_O034 =
  '=== TASK ===\nORDEM o-034 (planejador). PAPEL: planejador na hierarquia de chats do projeto C:\\Users\\User\\Desktop\\Projetos\\orca.\nObservable acceptance: produza a prova pedida nos criterios, rode: hierarquia entregar --ordem o-034 --prova CAMINHO_DA_PROVA (uma opcao --prova por\narquivo), e so depois envie worker_done como manda o seu preambulo.'

test('o-034: caixa vazia, ordem no rascunho e done pede envio, nunca "comecou"', () => {
  const onde = ondeEstaAOrdem(TELA_DA_O033, RASCUNHO_DA_O034, TRECHOS_DA_O034)
  assert.equal(onde, 'na_caixa')
  const espera = decidirInicio(BASE, { atividade: 'done', onde }, 2000)
  assert.equal(espera.acao, 'esperar')
  assert.equal(decidirInicio(espera.vigia, { atividade: 'done', onde }, 6500).acao, 'enviar')
})

test('com a ordem ainda parada depois de muitos envios, o Enter continua sendo reenviado', () => {
  const parado = { ...BASE, naCaixaDesde: 1000, tentouEnviarEm: 5000, envios: 12 }
  assert.equal(decidirInicio(parado, { atividade: 'done', onde: 'na_caixa' }, 26000).acao, 'enviar')
})
