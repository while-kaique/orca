import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rotuloDaSituacao } from './estado-na-tela.mjs'
import {
  acharWorkerNovo,
  decidirConferencia,
  decidirEntrega,
  decidirInicio,
  decidirOrdem,
  decidirPedidoDeOk,
  destinoDaPergunta,
  filaDoKaique,
  montarEstado,
  ondeEstaOTexto,
  ordensLiberadasDaEspera,
  temOkDoKaique
} from './regras.mjs'

const CAMPOS = {
  objetivo: 'Botao de exportar na tela inicial',
  porque: 'A equipe pede o arquivo todo dia',
  criterios: ['Clicar no botao baixa um CSV com as 3 colunas'],
  limites: 'Nao mexer no login',
  territorio: 'src/tela-inicial/'
}

let relogio = 0
function ev(tipo, dados) {
  relogio += 1
  return { t: relogio, tipo, ...dados }
}

/** PO + um planejador (P1) trabalhando. */
function base() {
  return [
    ev('po_criado', { chatId: 'PO' }),
    ev('ordem_criada', { ordemId: 'o-p1', de: 'PO', para: 'planejador', campos: CAMPOS }),
    ev('chat_lancado', { ordemId: 'o-p1', chatId: 'P1', modelo: 'opus' })
  ]
}

function comExecutores(eventos, pai, quantos, prefixo) {
  const saida = [...eventos]
  for (let i = 1; i <= quantos; i++) {
    saida.push(
      ev('ordem_criada', { ordemId: `o-${prefixo}${i}`, de: pai, para: 'executor', campos: CAMPOS })
    )
    saida.push(
      ev('chat_lancado', {
        ordemId: `o-${prefixo}${i}`,
        chatId: `${prefixo}${i}`,
        modelo: 'sonnet'
      })
    )
  }
  return saida
}

test('PO cria planejador com Opus e executor com Sonnet', () => {
  const estado = montarEstado([ev('po_criado', { chatId: 'PO' })])
  assert.deepEqual(decidirOrdem(estado, { de: 'PO', para: 'planejador', campos: CAMPOS }), {
    acao: 'criar',
    modelo: 'opus'
  })
  assert.deepEqual(decidirOrdem(estado, { de: 'PO', para: 'executor', campos: CAMPOS }), {
    acao: 'criar',
    modelo: 'sonnet'
  })
})

test('planejador cria executor, mas nao cria outro planejador', () => {
  const estado = montarEstado(base())
  assert.equal(decidirOrdem(estado, { de: 'P1', para: 'executor', campos: CAMPOS }).acao, 'criar')
  assert.deepEqual(decidirOrdem(estado, { de: 'P1', para: 'planejador', campos: CAMPOS }), {
    acao: 'recusar',
    motivo: 'Um planejador não pode criar um planejador.'
  })
})

test('executor nao cria chat nenhum', () => {
  const estado = montarEstado(comExecutores(base(), 'P1', 1, 'E'))
  assert.deepEqual(decidirOrdem(estado, { de: 'E1', para: 'executor', campos: CAMPOS }), {
    acao: 'recusar',
    motivo: 'Um executor não pode criar um executor.'
  })
})

test('chat que nao esta no registro e recusado', () => {
  const estado = montarEstado(base())
  assert.equal(
    decidirOrdem(estado, { de: 'intruso', para: 'executor', campos: CAMPOS }).acao,
    'recusar'
  )
})

test('ordem sem um dos cinco campos e recusada dizendo qual falta', () => {
  const estado = montarEstado(base())
  const semDois = { ...CAMPOS, porque: '  ', criterios: [] }
  assert.deepEqual(decidirOrdem(estado, { de: 'P1', para: 'executor', campos: semDois }), {
    acao: 'recusar',
    motivo: 'Faltam campos na ordem: porque, criterios.'
  })
})

test('terceiro planejador entra em espera', () => {
  const eventos = [
    ...base(),
    ev('ordem_criada', { ordemId: 'o-p2', de: 'PO', para: 'planejador', campos: CAMPOS }),
    ev('chat_lancado', { ordemId: 'o-p2', chatId: 'P2', modelo: 'opus' })
  ]
  assert.equal(
    decidirOrdem(montarEstado(eventos), { de: 'PO', para: 'planejador', campos: CAMPOS }).acao,
    'esperar'
  )
})

test('quinto executor do mesmo planejador espera; o de outro planejador nao', () => {
  const eventos = comExecutores(
    [
      ...base(),
      ev('ordem_criada', { ordemId: 'o-p2', de: 'PO', para: 'planejador', campos: CAMPOS }),
      ev('chat_lancado', { ordemId: 'o-p2', chatId: 'P2', modelo: 'opus' })
    ],
    'P1',
    4,
    'E'
  )
  const estado = montarEstado(eventos)
  assert.equal(decidirOrdem(estado, { de: 'P1', para: 'executor', campos: CAMPOS }).acao, 'esperar')
  assert.equal(decidirOrdem(estado, { de: 'P2', para: 'executor', campos: CAMPOS }).acao, 'criar')
})

test('vaga que abre libera a ordem em espera mais antiga', () => {
  const eventos = [
    ...comExecutores(base(), 'P1', 4, 'E'),
    ev('ordem_criada', {
      ordemId: 'o-fila1',
      de: 'P1',
      para: 'executor',
      campos: CAMPOS,
      emEspera: true
    }),
    ev('ordem_criada', {
      ordemId: 'o-fila2',
      de: 'P1',
      para: 'executor',
      campos: CAMPOS,
      emEspera: true
    })
  ]
  assert.deepEqual(ordensLiberadasDaEspera(montarEstado(eventos)), [])
  eventos.push(ev('entrega', { ordemId: 'o-E1', portao: 'plano', provas: ['prova.png'] }))
  eventos.push(ev('conferencia', { ordemId: 'o-E1', por: 'P1', aprovada: true }))
  assert.deepEqual(ordensLiberadasDaEspera(montarEstado(eventos)), ['o-fila1'])
})

test('entrega sem prova, ou com prova que nao existe, nao e entrega', () => {
  const estado = montarEstado(comExecutores(base(), 'P1', 1, 'E'))
  assert.equal(decidirEntrega(estado, { ordemId: 'o-E1', por: 'E1', provas: [] }).acao, 'recusar')
  assert.deepEqual(
    decidirEntrega(estado, {
      ordemId: 'o-E1',
      por: 'E1',
      provas: [{ caminho: 'print.png', existe: false }]
    }),
    { acao: 'recusar', motivo: 'Prova não encontrada: print.png.', semProva: true }
  )
})

test('entrega de executor vai para o portao do plano; de planejador, para o do produto', () => {
  const estado = montarEstado(comExecutores(base(), 'P1', 1, 'E'))
  const prova = [{ caminho: 'print.png', existe: true }]
  assert.deepEqual(decidirEntrega(estado, { ordemId: 'o-E1', por: 'E1', provas: prova }), {
    acao: 'aceitar',
    portao: 'plano'
  })
  assert.deepEqual(decidirEntrega(estado, { ordemId: 'o-p1', por: 'P1', provas: prova }), {
    acao: 'aceitar',
    portao: 'produto'
  })
})

test('executor do atalho entrega direto no portao do produto', () => {
  const estado = montarEstado(comExecutores([ev('po_criado', { chatId: 'PO' })], 'PO', 1, 'A'))
  assert.deepEqual(
    decidirEntrega(estado, {
      ordemId: 'o-A1',
      por: 'A1',
      provas: [{ caminho: 'saida.txt', existe: true }]
    }),
    { acao: 'aceitar', portao: 'produto' }
  )
})

test('so quem deu a ordem confere, e reprovar exige motivo', () => {
  const eventos = comExecutores(base(), 'P1', 1, 'E')
  eventos.push(ev('entrega', { ordemId: 'o-E1', portao: 'plano', provas: ['print.png'] }))
  const estado = montarEstado(eventos)
  assert.equal(
    decidirConferencia(estado, { ordemId: 'o-E1', por: 'PO', aprovar: true }).acao,
    'recusar'
  )
  assert.equal(
    decidirConferencia(estado, { ordemId: 'o-E1', por: 'P1', aprovar: false, motivo: '' }).acao,
    'recusar'
  )
  assert.equal(
    decidirConferencia(estado, { ordemId: 'o-E1', por: 'P1', aprovar: true }).acao,
    'aprovar'
  )
})

test('primeira reprovacao devolve; a segunda sobe para o PO', () => {
  const eventos = comExecutores(base(), 'P1', 1, 'E')
  eventos.push(ev('entrega', { ordemId: 'o-E1', portao: 'plano', provas: ['print.png'] }))
  assert.deepEqual(
    decidirConferencia(montarEstado(eventos), {
      ordemId: 'o-E1',
      por: 'P1',
      aprovar: false,
      motivo: 'faltou a coluna 3'
    }),
    { acao: 'devolver' }
  )
  eventos.push(
    ev('conferencia', { ordemId: 'o-E1', por: 'P1', aprovada: false, motivo: 'faltou a coluna 3' })
  )
  eventos.push(ev('entrega', { ordemId: 'o-E1', portao: 'plano', provas: ['print2.png'] }))
  assert.deepEqual(
    decidirConferencia(montarEstado(eventos), {
      ordemId: 'o-E1',
      por: 'P1',
      aprovar: false,
      motivo: 'ainda falta'
    }),
    { acao: 'subir', para: 'PO' }
  )
})

test('segunda reprovacao no portao do produto sobe para o Kaique e aparece na fila dele', () => {
  const eventos = base()
  eventos.push(ev('entrega', { ordemId: 'o-p1', portao: 'produto', provas: ['a.png'] }))
  eventos.push(
    ev('conferencia', {
      ordemId: 'o-p1',
      por: 'PO',
      aprovada: false,
      motivo: 'nao serve ao usuario novo'
    })
  )
  eventos.push(ev('entrega', { ordemId: 'o-p1', portao: 'produto', provas: ['b.png'] }))
  assert.deepEqual(
    decidirConferencia(montarEstado(eventos), {
      ordemId: 'o-p1',
      por: 'PO',
      aprovar: false,
      motivo: 'continua'
    }),
    { acao: 'subir', para: 'kaique' }
  )
  eventos.push(
    ev('conferencia', {
      ordemId: 'o-p1',
      por: 'PO',
      aprovada: false,
      motivo: 'continua',
      subiuPara: 'kaique'
    })
  )
  assert.deepEqual(filaDoKaique(montarEstado(eventos)), [
    { tipo: 'reprovada_duas_vezes', ordemId: 'o-p1', chatId: 'PO' }
  ])
})

test('so o PO pede OK, e so do que aprovou; sem OK nada esta liberado', () => {
  const eventos = base()
  eventos.push(ev('entrega', { ordemId: 'o-p1', portao: 'produto', provas: ['a.png'] }))
  assert.equal(
    decidirPedidoDeOk(montarEstado(eventos), { ordemId: 'o-p1', por: 'PO' }).acao,
    'recusar'
  )
  eventos.push(ev('conferencia', { ordemId: 'o-p1', por: 'PO', aprovada: true }))
  assert.equal(
    decidirPedidoDeOk(montarEstado(eventos), { ordemId: 'o-p1', por: 'P1' }).acao,
    'recusar'
  )
  assert.equal(
    decidirPedidoDeOk(montarEstado(eventos), { ordemId: 'o-p1', por: 'PO' }).acao,
    'pedir'
  )
  eventos.push(ev('pedido_ok', { ordemId: 'o-p1', resumo: 'Botao de exportar pronto' }))
  assert.equal(temOkDoKaique(montarEstado(eventos), 'o-p1'), false)
  assert.deepEqual(filaDoKaique(montarEstado(eventos)), [
    {
      tipo: 'ok',
      ordemId: 'o-p1',
      chatId: 'PO',
      resumo: 'Botao de exportar pronto',
      provas: ['a.png']
    }
  ])
  eventos.push(ev('ok', { ordemId: 'o-p1' }))
  assert.equal(temOkDoKaique(montarEstado(eventos), 'o-p1'), true)
  assert.deepEqual(filaDoKaique(montarEstado(eventos)), [])
})

test('duvida sobe um nivel por vez ate o Kaique', () => {
  const estado = montarEstado(comExecutores(base(), 'P1', 1, 'E'))
  assert.equal(destinoDaPergunta(estado, 'E1'), 'P1')
  assert.equal(destinoDaPergunta(estado, 'P1'), 'PO')
  assert.equal(destinoDaPergunta(estado, 'PO'), 'kaique')
})

test('o registro marca o chat em que o Kaique mexeu e o que parou sem entregar', () => {
  const eventos = comExecutores(base(), 'P1', 1, 'E')
  eventos.push(ev('kaique_mexeu', { chatId: 'E1' }))
  eventos.push(ev('parou_sem_entregar', { ordemId: 'o-E1' }))
  const estado = montarEstado(eventos)
  assert.equal(estado.chats.E1.mexidoPeloKaique, true)
  assert.equal(estado.ordens['o-E1'].situacao, 'parou')
})

test('chat que terminou continua aberto; so fecha para dar lugar a outro', () => {
  const eventos = comExecutores(base(), 'P1', 4, 'E')
  eventos.push(ev('entrega', { ordemId: 'o-E2', portao: 'plano', provas: ['prova.png'] }))
  eventos.push(ev('conferencia', { ordemId: 'o-E2', por: 'P1', aprovada: true }))
  const estado = montarEstado(eventos)
  assert.equal(estado.chats.E2.ativo, true)
  assert.deepEqual(decidirOrdem(estado, { de: 'P1', para: 'executor', campos: CAMPOS }), {
    acao: 'criar',
    modelo: 'sonnet',
    fechar: 'E2'
  })
})

test('com vaga sobrando nada e fechado, mesmo havendo chat terminado', () => {
  const eventos = comExecutores(base(), 'P1', 2, 'E')
  eventos.push(ev('entrega', { ordemId: 'o-E1', portao: 'plano', provas: ['prova.png'] }))
  eventos.push(ev('conferencia', { ordemId: 'o-E1', por: 'P1', aprovada: true }))
  assert.deepEqual(
    decidirOrdem(montarEstado(eventos), { de: 'P1', para: 'executor', campos: CAMPOS }),
    {
      acao: 'criar',
      modelo: 'sonnet'
    }
  )
})

test('PO com a aba fechada deixa o projeto sem PO', () => {
  const estado = montarEstado([
    ev('po_criado', { chatId: 'aba-po', handle: 'term-1' }),
    ev('chat_encerrado', { chatId: 'aba-po', motivo: 'aba fechada no Orca' })
  ])
  assert.equal(estado.po, null)
  assert.equal(estado.chats['aba-po'].ativo, false)
})

test('o chat e a aba; o identificador de terminal muda quando o Orca reabre', () => {
  const eventos = [
    ev('po_criado', { chatId: 'aba-po', handle: 'term-1' }),
    ev('chat_reconectado', { chatId: 'aba-po', handle: 'term-2' })
  ]
  const estado = montarEstado(eventos)
  assert.equal(estado.po, 'aba-po')
  assert.equal(estado.chats['aba-po'].handle, 'term-2')
  assert.equal(
    decidirOrdem(estado, { de: 'aba-po', para: 'planejador', campos: CAMPOS }).acao,
    'criar'
  )
})

test('chat registrado ao nascer ja tem papel e criador; lancamento que falha libera a vaga sem fantasma', () => {
  const nascendo = [
    ev('po_criado', { chatId: 'PO' }),
    ev('ordem_criada', { ordemId: 'o-1', de: 'PO', para: 'executor', campos: CAMPOS }),
    ev('chat_lancado', {
      ordemId: 'o-1',
      chatId: 'aba-1',
      modelo: 'sonnet',
      situacaoDoLancamento: 'esperando_o_orca'
    })
  ]
  const antes = montarEstado(nascendo)
  assert.equal(antes.chats['aba-1'].papel, 'executor')
  assert.equal(antes.chats['aba-1'].pai, 'PO')
  assert.equal(antes.ordens['o-1'].lancamento, 'esperando_o_orca')

  const depois = montarEstado([
    ...nascendo,
    ev('lancamento_falhou', { ordemId: 'o-1', chatId: 'aba-1', motivo: 'o Orca nao criou o chat' })
  ])
  assert.equal(depois.ordens['o-1'].situacao, 'parou')
  assert.equal(depois.ordens['o-1'].lancamentoFalhou, 'o Orca nao criou o chat')
  assert.equal(depois.chats['aba-1'].ativo, false)
})

test('chat novo e achado pelo titulo da tarefa, o unico dado que o task-list devolve', () => {
  const tarefas = [
    {
      id: 'task_fd04a248fde1',
      status: 'blocked',
      title: 'executor: Fluxograma: construir a mascara de carregamento do PO confor'
    },
    { id: 'task_fb061cb8ede3', status: 'blocked', title: 'correcao o-009' }
  ]
  const workers = [
    { dispatchId: 'ctx_7a4a509925ca', taskId: 'task_fd04a248fde1', terminal: 'term_e1003c10' },
    { dispatchId: 'ctx_90ca6351863f', taskId: 'task_fb061cb8ede3', terminal: 'term_5ce11f91' }
  ]
  const titulo = 'executor: Fluxograma: construir a mascara de carregamento do PO confor'
  assert.equal(
    acharWorkerNovo(workers, tarefas, new Set(['ctx_90ca6351863f']), titulo).dispatchId,
    'ctx_7a4a509925ca'
  )
  assert.equal(acharWorkerNovo(workers, tarefas, new Set(['ctx_7a4a509925ca']), titulo), null)
})

test('ordem parada na caixa e enviada uma vez so; chat que ja trabalha nao recebe nada', () => {
  const linha = '─'.repeat(40)
  const parada = [
    linha,
    '❯ ORDEM o-17 (executor). PAPEL: executor na',
    '  hierarquia',
    linha,
    '  barra'
  ]
  const andando = [
    '❯ ORDEM o-17 (executor). PAPEL: executor na',
    '● lendo',
    linha,
    '❯',
    linha,
    '  barra'
  ]
  const trecho = 'ORDEM o-17 (executor). PAPEL: executor'
  assert.equal(ondeEstaOTexto(parada, trecho), 'na_caixa')
  assert.equal(ondeEstaOTexto(andando, trecho), 'no_historico')

  let vigia = { naCaixaDesde: null, tentouEnviarEm: null, enviadaEm: null, comecouEm: null }
  const parado = { atividade: 'done', onde: 'na_caixa' }
  const acoes = [1000, 3000, 5500, 9000].map((t) => {
    const r = decidirInicio(vigia, parado, t)
    vigia = r.acao === 'enviar' ? { ...r.vigia, tentouEnviarEm: t } : r.vigia
    return r.acao
  })
  assert.deepEqual(acoes, ['esperar', 'esperar', 'enviar', 'esperar'])
  assert.equal(
    decidirInicio(vigia, { atividade: 'working', onde: 'no_historico' }, 12000).acao,
    'comecou'
  )
  const sozinho = { naCaixaDesde: null, tentouEnviarEm: null, enviadaEm: null, comecouEm: null }
  assert.equal(
    decidirInicio(sozinho, { atividade: 'working', onde: 'na_caixa' }, 1000).acao,
    'comecou'
  )
})

test('estado nao mostra trabalhando para chat que nunca comecou', () => {
  const nascendo = [
    ev('po_criado', { chatId: 'PO' }),
    ev('ordem_criada', { ordemId: 'o-1', de: 'PO', para: 'executor', campos: CAMPOS }),
    ev('chat_lancado', {
      ordemId: 'o-1',
      chatId: 'aba-1',
      modelo: 'sonnet',
      situacaoDoLancamento: 'esperando_o_orca'
    })
  ]
  const rotulo = (extra) => rotuloDaSituacao(montarEstado([...nascendo, ...extra]).ordens['o-1'])
  assert.match(rotulo([]), /inicio ainda nao confirmado/)
  assert.match(
    rotulo([ev('chat_nao_iniciou', { ordemId: 'o-1', naCaixa: true })]),
    /ORDEM NAO ENVIADA/
  )
  assert.match(
    rotulo([ev('chat_nao_iniciou', { ordemId: 'o-1', naCaixa: false })]),
    /inicio NAO confirmado/
  )
  assert.equal(rotulo([ev('chat_iniciou', { ordemId: 'o-1' })]), 'trabalhando')
  assert.equal(
    rotulo([ev('lancamento_respondeu', { ordemId: 'o-1', situacaoDoLancamento: 'ready' })]),
    'trabalhando'
  )
})
