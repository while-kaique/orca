// Regras da hierarquia PO > Planejador > Executor (spec 001). Puro: sem disco, sem rede, sem Orca.

export const PAPEIS = {
  po: { modelo: 'fable', cria: ['planejador', 'executor'] },
  planejador: { modelo: 'opus', cria: ['executor'] },
  executor: { modelo: 'sonnet', cria: [] }
}

/** Por projeto: chats trabalhando ao mesmo tempo. Executores somam todos os criadores (adendo 2 da o-021). */
export const TETO = { planejadoresPorProjeto: 2, executoresPorProjeto: 2 }

export const CAMPOS_DA_ORDEM = ['objetivo', 'porque', 'criterios', 'limites', 'territorio']

export const LIMITE_DE_REPROVACOES = 2

/** Situações em que o chat da ordem ainda não pode dar lugar a outro. */
const SITUACOES_ATIVAS = new Set([
  'trabalhando',
  'em_prova',
  'conferindo_plano',
  'conferindo_produto',
  'devolvido'
])

/** Ocupa vaga: o chat está trabalhando. Entrega esperando conferência solta a vaga, senão a fila trava com o criador dormindo. */
const OCUPA_VAGA = new Set(['trabalhando', 'em_prova', 'devolvido'])

/** Ainda não terminou, do ponto de vista de quem criou. */
const NAO_TERMINADA = new Set([...OCUPA_VAGA, 'em_espera'])

function campoVazio(valor) {
  if (Array.isArray(valor)) {
    return valor.length === 0 || valor.some((item) => String(item ?? '').trim() === '')
  }
  return String(valor ?? '').trim() === ''
}

export function camposFaltando(campos) {
  return CAMPOS_DA_ORDEM.filter((nome) => campoVazio(campos?.[nome]))
}

/** Reconstrói o estado do projeto a partir das linhas do registro, na ordem em que foram escritas. */
export function montarEstado(eventos) {
  const estado = { po: null, chats: {}, ordens: {}, perguntas: {}, avisos: {} }
  for (const ev of eventos) {
    const ordem = ev.ordemId ? estado.ordens[ev.ordemId] : undefined
    switch (ev.tipo) {
      case 'po_criado':
        estado.po = ev.chatId
        estado.chats[ev.chatId] = {
          id: ev.chatId,
          handle: ev.handle ?? null,
          papel: 'po',
          modelo: PAPEIS.po.modelo,
          pai: null,
          ordemId: null,
          ativo: true,
          mexidoPeloKaique: false
        }
        break
      case 'ordem_criada':
        estado.ordens[ev.ordemId] = {
          id: ev.ordemId,
          de: ev.de,
          papel: ev.para,
          campos: ev.campos,
          situacao: ev.emEspera ? 'em_espera' : 'trabalhando',
          pedido: ev.pedido ?? ev.ordemId,
          prioridade: Boolean(ev.prioridade),
          pastaDoCriador: ev.pastaDoCriador ?? null,
          chegada: Object.keys(estado.ordens).length,
          chatId: null,
          reprovacoes: 0,
          provas: [],
          historico: []
        }
        break
      case 'chat_lancado':
        ordem.chatId = ev.chatId
        ordem.dispatchId = ev.dispatchId
        ordem.pasta = ev.pasta
        ordem.situacao = 'trabalhando'
        ordem.lancamento = ev.situacaoDoLancamento
        ordem.lancadoEm = ev.t
        ordem.inicioDesistido = false
        ordem.inicio = ev.situacaoDoLancamento === 'ready' ? 'confirmado' : 'pendente'
        estado.chats[ev.chatId] = {
          id: ev.chatId,
          handle: ev.handle ?? null,
          papel: ordem.papel,
          modelo: ev.modelo,
          pai: ordem.de,
          ordemId: ordem.id,
          ativo: true,
          mexidoPeloKaique: false
        }
        break
      case 'lancamento_respondeu':
        ordem.pasta = ev.pasta ?? ordem.pasta
        ordem.lancamento = ev.situacaoDoLancamento
        if (ev.situacaoDoLancamento === 'ready') {
          ordem.inicio = 'confirmado'
        }
        break
      case 'chat_iniciou':
        ordem.inicio = 'confirmado'
        ordem.iniciouEm = ev.em ?? ev.t
        break
      case 'chat_nao_iniciou':
        ordem.inicio = ev.naCaixa ? 'nao_enviada' : 'nao_confirmado'
        ordem.inicioDesistido = Boolean(ev.desistiu)
        break
      case 'lancamento_falhou':
        ordem.situacao = 'parou'
        ordem.lancamentoFalhou = ev.motivo
        if (ev.chatId && estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].ativo = false
        }
        break
      case 'entrega_recusada':
        ordem.situacao = 'em_prova'
        break
      case 'entrega':
        ordem.provas = ev.provas
        ordem.situacao = ev.portao === 'plano' ? 'conferindo_plano' : 'conferindo_produto'
        break
      case 'conferencia':
        ordem.historico.push({ por: ev.por, t: ev.t, aprovada: ev.aprovada, motivo: ev.motivo })
        if (ev.aprovada) {
          ordem.situacao = 'aprovado'
        } else {
          ordem.reprovacoes += 1
          ordem.situacao = ev.subiuPara ? 'subiu' : 'devolvido'
          ordem.subiuPara = ev.subiuPara
        }
        break
      case 'pedido_ok':
        ordem.situacao = 'esperando_kaique'
        ordem.resumo = ev.resumo
        break
      case 'ok':
        ordem.situacao = 'liberado'
        ordem.historico.push({ por: 'kaique', t: ev.t, aprovada: true })
        break
      case 'devolvido_pelo_kaique':
        ordem.situacao = 'devolvido'
        ordem.historico.push({ por: 'kaique', t: ev.t, aprovada: false, motivo: ev.motivo })
        break
      case 'saiu_da_espera':
        ordem.situacao = 'trabalhando'
        break
      case 'parou_sem_entregar':
        ordem.situacao = 'parou'
        ordem.motivoDaParada = ev.motivo
        ordem.paradaAutomatica = Boolean(ev.automatico)
        break
      case 'chat_encerrado':
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].ativo = false
        }
        if (estado.po === ev.chatId) {
          estado.po = null
        }
        break
      case 'chat_reconectado':
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].handle = ev.handle
        }
        break
      case 'kaique_mexeu':
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].mexidoPeloKaique = true
        }
        break
      case 'pergunta':
        estado.perguntas[ev.perguntaId] = {
          id: ev.perguntaId,
          de: ev.de,
          para: ev.para,
          texto: ev.texto,
          resposta: null
        }
        break
      case 'pergunta_subiu':
        estado.perguntas[ev.perguntaId].para = ev.para
        break
      case 'resposta':
        estado.perguntas[ev.perguntaId].resposta = ev.texto
        break
      case 'pedido_fechado':
        estado.avisos[`${ev.chatId} ${ev.pedido}`] = ev.assinatura
        break
    }
  }
  return estado
}

function ocupandoVaga(estado, papel) {
  return Object.values(estado.ordens).filter(
    (ordem) => ordem.papel === papel && OCUPA_VAGA.has(ordem.situacao)
  ).length
}

const TETO_DO_PAPEL = {
  planejador: () => TETO.planejadoresPorProjeto,
  executor: () => TETO.executoresPorProjeto
}

function vagaLivre(estado, para) {
  return ocupandoVaga(estado, para) < TETO_DO_PAPEL[para]()
}

/** O que `hierarquia estado` mostra do teto: quem trabalha, o limite e quem espera vaga. */
export function ocupacao(estado) {
  return {
    planejadores: ocupandoVaga(estado, 'planejador'),
    executores: ocupandoVaga(estado, 'executor'),
    teto: TETO,
    emEspera: Object.values(estado.ordens)
      .filter((ordem) => ordem.situacao === 'em_espera')
      .map((ordem) => ordem.id)
  }
}

/** FR-3, FR-4, FR-5, FR-10, FR-20: quem cria quem, modelo por papel, cinco campos e teto. */
export function decidirOrdem(estado, { de, para, campos }) {
  const criador = estado.chats[de]
  if (!criador) {
    return { acao: 'recusar', motivo: 'Este chat está fora da hierarquia do projeto.' }
  }
  if (!PAPEIS[para] || !PAPEIS[criador.papel].cria.includes(para)) {
    return { acao: 'recusar', motivo: `Um ${criador.papel} não pode criar um ${para}.` }
  }
  const faltando = camposFaltando(campos)
  if (faltando.length > 0) {
    return { acao: 'recusar', motivo: `Faltam campos na ordem: ${faltando.join(', ')}.` }
  }
  if (!vagaLivre(estado, para)) {
    return { acao: 'esperar', modelo: PAPEIS[para].modelo }
  }
  const fechar = chatParaFecharAoAbrir(estado, de, para)
  return { acao: 'criar', modelo: PAPEIS[para].modelo, ...(fechar ? { fechar } : {}) }
}

/**
 * FR-21: chat que terminou fica aberto até o Kaique fechar. O sistema só fecha um chat para dar
 * lugar a outro: o mais antigo que já terminou, quando os chats abertos enchem o teto.
 */
function chatParaFecharAoAbrir(estado, de, para) {
  const teto = TETO_DO_PAPEL[para]()
  // Só fecha chat criado pelo mesmo criador: chat de outro nunca é tocado.
  const abertos = Object.values(estado.chats).filter(
    (chat) => chat.ativo && chat.papel === para && chat.pai === de
  )
  if (abertos.length < teto) {
    return null
  }
  const terminado = abertos.find(
    (chat) => !SITUACOES_ATIVAS.has(estado.ordens[chat.ordemId]?.situacao)
  )
  return terminado?.id ?? null
}

/** FR-20: ordens em espera que já cabem no teto: primeiro as que passam na frente, depois por chegada. */
export function ordensLiberadasDaEspera(estado) {
  const liberadas = []
  const simulado = { ...estado, ordens: { ...estado.ordens } }
  for (const ordem of filaDeEspera(estado)) {
    if (ordem.situacao === 'em_espera' && vagaLivre(simulado, ordem.papel)) {
      liberadas.push(ordem.id)
      simulado.ordens[ordem.id] = { ...ordem, situacao: 'trabalhando' }
    }
  }
  return liberadas
}

/** Quem espera vaga, na ordem em que vai sair. */
export function filaDeEspera(estado) {
  return Object.values(estado.ordens)
    .filter((ordem) => ordem.situacao === 'em_espera')
    .sort((a, b) => Number(b.prioridade) - Number(a.prioridade) || a.chegada - b.chegada)
}

/** O pedido de uma ordem nova: o que o criador deu, senão o da ordem do próprio criador, senão ela mesma. */
export function pedidoDaOrdemNova(estado, de, pedidoDado) {
  if (String(pedidoDado ?? '').trim() !== '') {
    return String(pedidoDado).trim()
  }
  return estado.ordens[estado.chats[de]?.ordemId]?.pedido ?? null
}

/** A ordem e todas as criadas abaixo dela. */
function arvoreDaOrdem(estado, ordem) {
  const filhas = ordem.chatId
    ? Object.values(estado.ordens).filter((outra) => outra.de === ordem.chatId)
    : []
  return [ordem, ...filhas.flatMap((filha) => arvoreDaOrdem(estado, filha))]
}

/**
 * O que o criador espera, agrupado pelo pedido das ordens que ele criou: cada grupo junta essas ordens
 * e as de baixo delas. `assinatura` muda quando alguma ordem do grupo muda de situação.
 */
export function pedidosDoCriador(estado, criador) {
  const grupos = new Map()
  for (const ordem of Object.values(estado.ordens)) {
    if (ordem.de !== criador) {
      continue
    }
    const grupo = grupos.get(ordem.pedido) ?? { pedido: ordem.pedido, diretas: [], todas: [] }
    grupo.diretas.push(ordem)
    grupo.todas.push(...arvoreDaOrdem(estado, ordem))
    grupos.set(ordem.pedido, grupo)
  }
  return [...grupos.values()].map((grupo) => ({
    ...grupo,
    terminado: grupo.todas.every((ordem) => !NAO_TERMINADA.has(ordem.situacao)),
    assinatura: grupo.todas.map((ordem) => `${ordem.id}:${ordem.situacao}`).join(',')
  }))
}

/** Pedidos que fecharam e ainda não viraram mensagem para o criador nesta situação. */
export function pedidosParaAvisar(estado, criador) {
  return pedidosDoCriador(estado, criador).filter(
    (grupo) => grupo.terminado && estado.avisos[`${criador} ${grupo.pedido}`] !== grupo.assinatura
  )
}

const ENTREGUE = new Set([
  'conferindo_plano',
  'conferindo_produto',
  'aprovado',
  'esperando_kaique',
  'liberado'
])

/** A mensagem única de um pedido: quais ordens entregaram e quais pararam. */
export function mensagemDoPedido(grupo) {
  const lista = (ordens) =>
    ordens.length === 0
      ? 'nenhuma'
      : ordens.map((ordem) => `${ordem.id} (${ordem.situacao})`).join(', ')
  const entregaram = grupo.diretas.filter((ordem) => ENTREGUE.has(ordem.situacao))
  const pararam = grupo.diretas.filter((ordem) => !ENTREGUE.has(ordem.situacao))
  return `PEDIDO FECHADO: ${grupo.pedido}. Entregaram: ${lista(entregaram)}. Pararam: ${lista(pararam)}. Rode hierarquia estado e confira o pacote.`
}

function situacaoDoPedido(ordens) {
  if (ordens.some((ordem) => OCUPA_VAGA.has(ordem.situacao))) {
    return 'em andamento'
  }
  if (ordens.some((ordem) => ordem.situacao === 'em_espera')) {
    return 'esperando vaga'
  }
  if (ordens.some((ordem) => ['conferindo_plano', 'conferindo_produto'].includes(ordem.situacao))) {
    return 'esperando validar'
  }
  return ordens.every((ordem) => ordem.situacao === 'parou') ? 'parado' : 'entregue'
}

/** Cada pedido do projeto para `hierarquia estado`, com a posição de quem espera vaga. */
export function pedidosNoEstado(estado) {
  const fila = filaDeEspera(estado).map((ordem) => ordem.id)
  const grupos = new Map()
  for (const ordem of Object.values(estado.ordens)) {
    const lista = grupos.get(ordem.pedido) ?? []
    lista.push({ ...ordem, posicaoNaFila: fila.indexOf(ordem.id) + 1 || null })
    grupos.set(ordem.pedido, lista)
  }
  return [...grupos.entries()].map(([pedido, ordens]) => ({
    pedido,
    ordens,
    situacao: situacaoDoPedido(ordens)
  }))
}

/**
 * Chat morto: a ordem ocupa vaga, mas a aba não existe mais, o terminal caiu ou não sai nada na tela
 * há mais que `prazoMs` (sem pergunta aberta e sem ordem filha por terminar, que são esperas legítimas).
 */
export function chatsSemVida(estado, terminais, agora, prazoMs) {
  const mortos = []
  for (const ordem of Object.values(estado.ordens)) {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    if (!chat || !OCUPA_VAGA.has(ordem.situacao)) {
      continue
    }
    const terminal =
      terminais.find((t) => t.tabId === chat.id) ?? terminais.find((t) => t.handle === chat.handle)
    if (!terminal) {
      mortos.push({
        ordemId: ordem.id,
        motivo: 'o chat nao tem terminal ligado (aba fechada ou dormindo)'
      })
      continue
    }
    if (terminal.connected === false) {
      mortos.push({ ordemId: ordem.id, motivo: 'o terminal do chat caiu' })
      continue
    }
    const esperando =
      Object.values(estado.perguntas).some((p) => p.de === chat.id && p.resposta === null) ||
      Object.values(estado.ordens).some(
        (filha) => filha.de === chat.id && NAO_TERMINADA.has(filha.situacao)
      )
    const parado = terminal.lastOutputAt ? agora - terminal.lastOutputAt : 0
    if (!esperando && parado > prazoMs) {
      mortos.push({
        ordemId: ordem.id,
        motivo: `nada na tela do chat ha ${Math.round(parado / 60000)} min`
      })
    }
  }
  return mortos
}

/**
 * Ligado (terminal vivo), dormindo (a aba existe sem terminal, como o fluxograma desenha depois de
 * reabrir o Orca) ou fechado (a aba sumiu). `abas` null: sem a sessão do Orca, só dá para dizer ligado.
 */
export function vidaDoChat(chat, terminais, abas) {
  const terminal =
    terminais.find((t) => t.tabId === chat.id) ?? terminais.find((t) => t.handle === chat.handle)
  if (terminal && terminal.connected !== false) {
    return 'ligado'
  }
  if (!abas) {
    return 'sem terminal'
  }
  return abas.has(chat.id) ? 'dormindo' : 'fechado'
}

/**
 * Vez para comando pesado. `dono` segura a vez; `fila` espera, por chegada. Dono morto solta a vez, e
 * ela vai ao primeiro vivo da fila.
 */
export function decidirVez({ dono, fila, vivo }) {
  const donoVivo = Boolean(dono) && vivo(dono.pid)
  const vivos = fila.filter((item) => vivo(item.pid)).sort((a, b) => a.chegada - b.chegada)
  return {
    soltarDono: Boolean(dono) && !donoVivo,
    proximo: donoVivo ? null : (vivos[0] ?? null),
    mortosNaFila: fila.filter((item) => !vivo(item.pid))
  }
}

/** Quem confere a entrega é quem deu a ordem: planejador confere o plano, PO confere o produto. */
function portaoDa(estado, ordem) {
  return estado.chats[ordem.de]?.papel === 'planejador' ? 'plano' : 'produto'
}

/** FR-11: entrega sem prova existente é tratada como não entregue. */
export function decidirEntrega(estado, { ordemId, por, provas }) {
  const ordem = estado.ordens[ordemId]
  if (!ordem || ordem.chatId !== por) {
    return { acao: 'recusar', motivo: 'Esta ordem não é deste chat.' }
  }
  if (!['trabalhando', 'em_prova', 'devolvido'].includes(ordem.situacao)) {
    return { acao: 'recusar', motivo: `A ordem está em "${ordem.situacao}" e não aceita entrega.` }
  }
  if (!provas || provas.length === 0) {
    return {
      acao: 'recusar',
      motivo: 'Entrega sem prova. Aponte a prova pedida nos critérios.',
      semProva: true
    }
  }
  const ausentes = provas.filter((prova) => !prova.existe).map((prova) => prova.caminho)
  if (ausentes.length > 0) {
    return {
      acao: 'recusar',
      motivo: `Prova não encontrada: ${ausentes.join(', ')}.`,
      semProva: true
    }
  }
  return { acao: 'aceitar', portao: portaoDa(estado, ordem) }
}

/** FR-12, FR-13: reprovação exige motivo; a segunda reprovação sobe um nível. */
export function decidirConferencia(estado, { ordemId, por, aprovar, motivo }) {
  const ordem = estado.ordens[ordemId]
  if (!ordem || ordem.de !== por) {
    return { acao: 'recusar', motivo: 'Só quem deu a ordem confere a entrega.' }
  }
  if (!['conferindo_plano', 'conferindo_produto'].includes(ordem.situacao)) {
    return { acao: 'recusar', motivo: 'Não há entrega esperando conferência nesta ordem.' }
  }
  if (aprovar) {
    return { acao: 'aprovar' }
  }
  if (String(motivo ?? '').trim() === '') {
    return { acao: 'recusar', motivo: 'Reprovação exige o motivo por escrito.' }
  }
  if (ordem.reprovacoes + 1 >= LIMITE_DE_REPROVACOES) {
    // Acima do PO só existe o Kaique.
    return { acao: 'subir', para: estado.chats[por].pai ?? 'kaique' }
  }
  return { acao: 'devolver' }
}

/** FR-14: só o PO pede o OK, e só de entrega que ele mesmo aprovou. */
export function decidirPedidoDeOk(estado, { ordemId, por }) {
  const ordem = estado.ordens[ordemId]
  if (estado.chats[por]?.papel !== 'po') {
    return { acao: 'recusar', motivo: 'Só o PO pede o OK do Kaique.' }
  }
  if (!ordem || ordem.de !== por || ordem.situacao !== 'aprovado') {
    return {
      acao: 'recusar',
      motivo: 'O PO só pede OK de entrega que ele aprovou no portão do produto.'
    }
  }
  return { acao: 'pedir' }
}

/** FR-14: juntar, publicar ou gravar em sistema real só com OK registrado para aquela entrega. */
export function temOkDoKaique(estado, ordemId) {
  return estado.ordens[ordemId]?.situacao === 'liberado'
}

/** FR-16: tudo que espera o Kaique neste projeto. */
export function filaDoKaique(estado) {
  const itens = []
  for (const ordem of Object.values(estado.ordens)) {
    if (ordem.situacao === 'esperando_kaique') {
      itens.push({
        tipo: 'ok',
        ordemId: ordem.id,
        chatId: ordem.de,
        resumo: ordem.resumo,
        provas: ordem.provas
      })
    }
    if (ordem.situacao === 'subiu' && ordem.subiuPara === 'kaique') {
      itens.push({ tipo: 'reprovada_duas_vezes', ordemId: ordem.id, chatId: ordem.de })
    }
  }
  for (const pergunta of Object.values(estado.perguntas)) {
    if (pergunta.para === 'kaique' && pergunta.resposta === null) {
      itens.push({
        tipo: 'pergunta',
        perguntaId: pergunta.id,
        chatId: pergunta.de,
        texto: pergunta.texto
      })
    }
  }
  return itens
}

/** FR-16: a dúvida sobe um nível por vez; acima do PO é o Kaique. */
export function destinoDaPergunta(estado, de) {
  const chat = estado.chats[de]
  if (!chat) {
    return null
  }
  return chat.pai ?? 'kaique'
}

const MARCA_DE_COLAGEM = '[Pasted text'
const LINHA_DE_SEPARACAO = /^[─━-]{10,}$/u

function emUmaLinha(linhas) {
  return linhas.join(' ').replace(/\s+/gu, ' ')
}

/**
 * A tarefa nova é a que não existia antes e tem o título dado ao worker-start. O `task-list` já a mostra,
 * com `dispatchId`, enquanto o worker ainda está `starting` (sem terminal no `worker-list`).
 */
export function acharTarefaNova(tarefas, antes, titulo) {
  return tarefas.find((t) => t.title === titulo && t.dispatchId && !antes.has(t.id)) ?? null
}

/**
 * O terminal do chat novo: o `assignee` da tarefa, quando já existe; antes disso, o único terminal
 * de agente (`agentIdentity`) que não existia antes. Com dois ou mais candidatos não adivinha.
 */
export function acharTerminalNovo(terminais, antes, assignee) {
  if (assignee) {
    return terminais.find((t) => t.handle === assignee) ?? null
  }
  const novos = terminais.filter((t) => t.agentIdentity === 'claude' && !antes.has(t.handle))
  return novos.length === 1 ? novos[0] : null
}

/** Onde o texto enviado está na tela do chat: digitado na caixa de entrada (ainda não enviado) ou já no histórico. */
export function ondeEstaOTexto(linhas, trecho) {
  const tela = linhas.map((linha) => String(linha).trim())
  const caixa = tela.findLastIndex((linha) => linha.startsWith('❯'))
  if (caixa === -1) {
    return emUmaLinha(tela).includes(trecho) ? 'no_historico' : 'ausente'
  }
  let fim = tela.findIndex((linha, i) => i > caixa && LINHA_DE_SEPARACAO.test(linha))
  fim = fim === -1 ? tela.length : fim
  const dentro = emUmaLinha(tela.slice(caixa, fim))
  if (dentro.includes(trecho) || dentro.includes(MARCA_DE_COLAGEM)) {
    return 'na_caixa'
  }
  return emUmaLinha(tela.slice(0, caixa)).includes(trecho) ? 'no_historico' : 'ausente'
}

/**
 * Onde está a ordem. O `terminal read` do Orca tira da tela o texto digitado e ainda não enviado e o
 * devolve à parte, em `rascunho`: a caixa aparece vazia e a ordem inteira está ali (o-033). Rascunho com
 * o começo ou o fim da ordem, ou o marcador de texto colado que o Claude põe no lugar de texto longo,
 * conta como ordem parada na caixa; a conversa tem prioridade.
 */
export function ondeEstaAOrdem(linhas, rascunho, trechos) {
  const naTela = linhas ? ondeEstaOTexto(linhas, trechos[0]) : 'desconhecido'
  const digitado = emUmaLinha([String(rascunho ?? '')]).trim()
  const ordemNoRascunho =
    trechos.some((t) => digitado.includes(t)) || digitado.startsWith(MARCA_DE_COLAGEM)
  if (naTela !== 'no_historico' && digitado !== '' && ordemNoRascunho) {
    return 'na_caixa'
  }
  return naTela
}

export const ESTABILIDADE_DA_CAIXA_MS = 4000
/** Depois de enviar, o texto precisa continuar na caixa por este tempo para valer um novo envio (a tecla pode ter se perdido). */
export const REENVIO_APOS_MS = 20000
/** Enquanto a ordem estiver parada, o Enter segue sendo reenviado (a cada REENVIO_APOS_MS); o prazo de 45 min do vigia é o freio. */
export const MAXIMO_DE_ENVIOS = 60
/** O comando que lancou o chat tem ate isto para confirmar o inicio; depois, quem insiste e o vigia do criador. */
export const JANELA_DO_COMANDO_MS = 10 * 60 * 1000
/** Quanto tempo o vigia do criador insiste num chat que nao comecou, a contar do lancamento. */
export const PRAZO_DE_INSISTIR_MS = 45 * 60 * 1000

/**
 * Um passo da conferência do início do turno. `vigia` guarda o que já foi visto/feito; `visto` é
 * {atividade, onde}. Só envia com o texto parado na caixa; chat que já trabalha nunca recebe tecla.
 * Reenvia se o texto continua na caixa bem depois do último envio.
 */
export function decidirInicio(vigia, visto, agora) {
  if (vigia.comecouEm) {
    return { acao: 'comecou', vigia }
  }
  // Só prova positiva vale: trabalhando, ou a ordem já na conversa. 'done' não prova nada (o Orca o marca
  // também em chat que nunca recebeu a ordem, como o da o-033).
  if (visto.atividade === 'working' || visto.onde === 'no_historico') {
    const fonte = visto.atividade === 'working' ? 'atividade' : 'tela'
    return { acao: 'comecou', vigia: { ...vigia, comecouEm: agora, fonte, onde: visto.onde } }
  }
  const proximo = { ...vigia, onde: visto.onde }
  if (visto.onde !== 'na_caixa') {
    // Leitura que falhou (máquina carregada) não prova que o texto saiu da caixa: a contagem continua.
    const desde = visto.onde === 'desconhecido' ? vigia.naCaixaDesde : null
    return { acao: 'esperar', vigia: { ...proximo, onde: vigia.onde, naCaixaDesde: desde } }
  }
  const desde = vigia.naCaixaDesde ?? agora
  const envios = vigia.envios ?? (vigia.tentouEnviarEm ? 1 : 0)
  const paradoDesde = envios === 0 ? desde : Math.max(desde, vigia.tentouEnviarEm ?? 0)
  const espera = envios === 0 ? ESTABILIDADE_DA_CAIXA_MS : REENVIO_APOS_MS
  if (envios < MAXIMO_DE_ENVIOS && agora - paradoDesde >= espera) {
    return { acao: 'enviar', vigia: { ...proximo, naCaixaDesde: desde, envios: envios + 1 } }
  }
  return { acao: 'esperar', vigia: { ...proximo, naCaixaDesde: desde, envios } }
}

/** A aba do criador some da lista do Orca com outro identificador depois de o Orca reabrir: vale achá-la também pelo terminal. */
export function criadorSemAba(terminais, chatId, handles) {
  const certos = handles.filter(Boolean)
  return (
    terminais.length > 0 && !terminais.some((t) => t.tabId === chatId || certos.includes(t.handle))
  )
}

/**
 * Ordens do criador cujo chat ainda não comecou e que o vigia deve destravar: as que o comando
 * já declarou sem início e as que ficaram "lançando" além da janela do comando (ele morreu).
 * `desistir` lista as que passaram do prazo de insistir e ainda não foram declaradas desistidas.
 */
export function ordensSemInicio(estado, eu, agora) {
  const tentar = []
  const desistir = []
  for (const ordem of Object.values(estado.ordens)) {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    if (
      ordem.de !== eu ||
      ordem.situacao !== 'trabalhando' ||
      !chat?.ativo ||
      ordem.inicio === 'confirmado' ||
      ordem.inicioDesistido
    ) {
      continue
    }
    const idade = agora - Date.parse(ordem.lancadoEm)
    if (Number.isNaN(idade)) {
      continue
    }
    if (idade >= PRAZO_DE_INSISTIR_MS) {
      desistir.push(ordem)
    } else if (ordem.inicio !== 'pendente' || idade >= JANELA_DO_COMANDO_MS) {
      tentar.push(ordem)
    }
  }
  return { tentar, desistir }
}
