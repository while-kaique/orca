// Regras da hierarquia PO > Planejador > Executor (spec 001). Puro: sem disco, sem rede, sem Orca.

/** Desde 16/11/2026 nao existe mais planejador: o PO (Opus) planeja e so cria executores (Sonnet). */
export const PAPEIS = {
  po: { modelo: 'opus', cria: ['executor'] },
  planejador: { modelo: 'opus', cria: [] },
  executor: { modelo: 'sonnet', cria: [] }
}

/** Esforco do raciocinio de todo chat lancado pelo comando (Orca: --effort). */
export const ESFORCO = 'high'

/** Chat de teste usa o modelo mais leve: so prova que o lancamento funciona (decisao do PO na o-043). */
export const MODELO_DO_TESTE = 'haiku'

/** Por projeto: chats trabalhando ao mesmo tempo. Quatro executores por PO; com o PO, ate cinco chats abertos. */
export const TETO = { executoresPorProjeto: 4, testesPorProjeto: 2 }

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
export const OCUPA_VAGA = new Set(['trabalhando', 'em_prova', 'devolvido'])

/** Ainda não terminou, do ponto de vista de quem criou. */
export const NAO_TERMINADA = new Set([...OCUPA_VAGA, 'em_espera'])

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
  const estado = { po: null, chats: {}, ordens: {}, perguntas: {}, avisos: {}, guardados: {} }
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
          teste: Boolean(ev.teste),
          criadaEm: ev.t,
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
          mexidoPeloKaique: false,
          ...(ordem.teste ? { teste: true } : {})
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
        ordem.paradaEm = ev.t
        break
      case 'conversa_perdida_avisada':
        if (ordem) {
          ordem.conversaAvisada = { sessao: ev.sessao ?? null, t: ev.t }
        }
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
      case 'aviso_guardado':
        estado.guardados[ev.avisoId] = {
          id: ev.avisoId,
          chatId: ev.chatId,
          texto: ev.texto,
          t: ev.t
        }
        break
      case 'aviso_entregue':
        delete estado.guardados[ev.avisoId]
        break
      case 'chat_cortado':
        if (ordem) {
          ordem.cortadoEm = ev.t
        }
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].cortadoEm = ev.t
          estado.chats[ev.chatId].retomadoEm = null
          estado.chats[ev.chatId].corteAvisado = false
        }
        break
      case 'comando_preso':
        if (ordem) {
          ordem.comandoPreso = { ferramentaId: ev.ferramentaId, desde: ev.desde, avisadoEm: ev.t }
        }
        break
      case 'chat_retomado':
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].retomadoEm = ev.t
        }
        break
      case 'corte_avisado':
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].corteAvisado = true
        }
        break
    }
  }
  return estado
}

function ocupandoVaga(estado, papel) {
  return Object.values(estado.ordens).filter(
    (ordem) =>
      (papel === 'teste' ? ordem.teste : ordem.papel === papel && !ordem.teste) &&
      OCUPA_VAGA.has(ordem.situacao)
  ).length
}

const TETO_DO_PAPEL = {
  executor: () => TETO.executoresPorProjeto,
  teste: () => TETO.testesPorProjeto
}

/** Chat de teste tem vaga própria: nunca disputa com trabalho de verdade. */
function vagaDa(ordem) {
  return ordem.teste ? 'teste' : ordem.papel
}

/** Papel sem teto (planejador de registro antigo) nunca sai da espera: ninguem o cria mais. */
function vagaLivre(estado, para) {
  return para in TETO_DO_PAPEL && ocupandoVaga(estado, para) < TETO_DO_PAPEL[para]()
}

/** O que `hierarquia estado` mostra do teto: quem trabalha, o limite e quem espera vaga. */
export function ocupacao(estado) {
  return {
    executores: ocupandoVaga(estado, 'executor'),
    testes: ocupandoVaga(estado, 'teste'),
    teto: TETO,
    emEspera: Object.values(estado.ordens)
      .filter((ordem) => ordem.situacao === 'em_espera')
      .map((ordem) => ordem.id)
  }
}

/**
 * O criador da ordem nao existe mais: o chat dele foi encerrado (ou a aba fechou, com `vidas`) ou ele e um PO antigo,
 * trocado por outro (complemento 3 da o-043: o-036/o-037 do planejador que caiu, o-001/o-014/o-015/o-018 de POs antigos).
 */
export function criadorSumiu(estado, ordem, vidas = null) {
  const criador = estado.chats[ordem.de]
  return (
    !criador ||
    !criador.ativo ||
    (criador.papel === 'po' && estado.po !== criador.id) ||
    vidas?.get(criador.id) === 'fechado'
  )
}

/** Quem pode dar baixa e fechar o chat da ordem: quem a criou, ou o PO atual quando o criador sumiu (ele herda). */
export function podeCuidarDaOrdem(estado, eu, ordem, vidas = null) {
  if (!ordem) {
    return false
  }
  return ordem.de === eu || (eu === estado.po && criadorSumiu(estado, ordem, vidas))
}

/** FR-3, FR-4, FR-5, FR-10, FR-20: quem cria quem, modelo por papel, cinco campos e teto. */
export function decidirOrdem(estado, { de, para, campos, teste = false, liberacao = null }) {
  const criador = estado.chats[de]
  if (!criador) {
    return { acao: 'recusar', motivo: 'Este chat está fora da hierarquia do projeto.' }
  }
  if (liberacao) {
    return {
      acao: 'recusar',
      motivo: `há uma liberação para reabrir o Orca em aberto desde ${liberacao.desde} (${liberacao.por ?? 'sem autor'}): lançar e reabrir nunca juntos. Espere o Orca reabrir (ela fecha sozinha) ou cancele com: hierarquia porta --cancelar`
    }
  }
  if (para === 'planejador') {
    return {
      acao: 'recusar',
      motivo:
        'Não existe mais planejador (regra do Kaique, 16/11/2026): o PO planeja e a ordem vai direto a um executor (--para executor).'
    }
  }
  // Chat de teste: qualquer papel cria (até o executor), só executor, título começando com TESTE.
  const podeCriar = teste
    ? para === 'executor'
    : PAPEIS[para] && PAPEIS[criador.papel].cria.includes(para)
  if (!podeCriar) {
    return {
      acao: 'recusar',
      motivo: teste
        ? 'Chat de teste é sempre --para executor.'
        : `Um ${criador.papel} não pode criar um ${para}.`
    }
  }
  if (teste && !/^TESTE\b/u.test(String(campos?.titulo ?? ''))) {
    return {
      acao: 'recusar',
      motivo: 'Chat de teste precisa de titulo começando com "TESTE" e dizendo o que testa.'
    }
  }
  const faltando = camposFaltando(campos)
  if (faltando.length > 0) {
    return { acao: 'recusar', motivo: `Faltam campos na ordem: ${faltando.join(', ')}.` }
  }
  if (!vagaLivre(estado, teste ? 'teste' : para)) {
    return { acao: 'esperar', modelo: teste ? MODELO_DO_TESTE : PAPEIS[para].modelo }
  }
  if (teste) {
    return { acao: 'criar', modelo: MODELO_DO_TESTE }
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
    (chat) => chat.ativo && chat.papel === para && chat.pai === de && !chat.teste
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
    if (ordem.situacao === 'em_espera' && vagaLivre(simulado, vagaDa(ordem))) {
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

/** Chat recém-lançado: o Orca ainda está ligando o terminal (leva minutos nesta máquina); nunca é dado como parado. */
export const GRACA_DO_LANCAMENTO_MS = 10 * 60 * 1000
/** A falta de terminal precisa se repetir por este tempo, em verificações seguidas, antes de a ordem ser dada como parada. */
export const ESPERA_ANTES_DE_DAR_COMO_PARADO_MS = 2 * 60 * 1000

/**
 * Chat morto: a ordem ocupa vaga, mas a aba não existe mais ou o terminal caiu. Terminal ligado nunca conta, chat
 * lançado há pouco nunca conta, e uma lista do Orca que falha uma vez não basta: `semVidaDesde` guarda desde quando cada
 * ordem aparece sem vida e só vira morta depois de ESPERA_ANTES_DE_DAR_COMO_PARADO_MS. Devolve `mortos` e o novo `semVidaDesde`.
 */
export function chatsSemVida(estado, terminais, agora, semVidaDesde = new Map()) {
  const agoraSemVida = new Map()
  const mortos = []
  for (const ordem of Object.values(estado.ordens)) {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    if (
      !chat ||
      !OCUPA_VAGA.has(ordem.situacao) ||
      agora - Date.parse(ordem.lancadoEm) < GRACA_DO_LANCAMENTO_MS
    ) {
      continue
    }
    const terminal =
      terminais.find((t) => t.tabId === chat.id) ?? terminais.find((t) => t.handle === chat.handle)
    if (terminal && terminal.connected !== false) {
      continue
    }
    const motivo = terminal
      ? 'o terminal do chat caiu'
      : 'o chat nao tem terminal ligado (aba fechada ou dormindo)'
    const desde = semVidaDesde.get(ordem.id) ?? agora
    agoraSemVida.set(ordem.id, desde)
    if (agora - desde >= ESPERA_ANTES_DE_DAR_COMO_PARADO_MS) {
      mortos.push({ ordemId: ordem.id, motivo })
    }
  }
  return { mortos, semVidaDesde: agoraSemVida }
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
  // Parada pelo sistema (chat dado como morto) e o chat entrega: a parada foi engano. Baixa de quem criou e lançamento falho não.
  const paradaPorEngano = ordem.situacao === 'parou' && ordem.paradaAutomatica
  if (!['trabalhando', 'em_prova', 'devolvido'].includes(ordem.situacao) && !paradaPorEngano) {
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

// O início do turno (tela, rascunho, Enter) mora em regras-do-inicio.mjs; quem importa daqui continua igual.
export * from './regras-do-inicio.mjs'
