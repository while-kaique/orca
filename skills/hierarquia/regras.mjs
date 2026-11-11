// Regras da hierarquia PO > Planejador > Executor (spec 001). Puro: sem disco, sem rede, sem Orca.

export const PAPEIS = {
  po: { modelo: 'fable', cria: ['planejador', 'executor'] },
  planejador: { modelo: 'opus', cria: ['executor'] },
  executor: { modelo: 'sonnet', cria: [] }
}

export const TETO = { planejadoresPorProjeto: 2, executoresPorPai: 4 }

export const CAMPOS_DA_ORDEM = ['objetivo', 'porque', 'criterios', 'limites', 'territorio']

export const LIMITE_DE_REPROVACOES = 2

/** Situações em que a ordem ainda ocupa uma vaga do teto. */
const SITUACOES_ATIVAS = new Set([
  'trabalhando',
  'em_prova',
  'conferindo_plano',
  'conferindo_produto',
  'devolvido'
])

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
  const estado = { po: null, chats: {}, ordens: {}, perguntas: {} }
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
      case 'parou_sem_entregar':
        ordem.situacao = 'parou'
        break
      case 'chat_encerrado':
        if (estado.chats[ev.chatId]) {
          estado.chats[ev.chatId].ativo = false
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
    }
  }
  return estado
}

function ordensAtivasDe(estado, criador, papel) {
  return Object.values(estado.ordens).filter(
    (ordem) =>
      ordem.papel === papel &&
      SITUACOES_ATIVAS.has(ordem.situacao) &&
      (criador === undefined || ordem.de === criador)
  )
}

function vagaLivre(estado, de, para) {
  if (para === 'planejador') {
    return ordensAtivasDe(estado, undefined, 'planejador').length < TETO.planejadoresPorProjeto
  }
  return ordensAtivasDe(estado, de, 'executor').length < TETO.executoresPorPai
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
  if (!vagaLivre(estado, de, para)) {
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
  const teto = para === 'planejador' ? TETO.planejadoresPorProjeto : TETO.executoresPorPai
  const abertos = Object.values(estado.chats).filter(
    (chat) => chat.ativo && chat.papel === para && (para === 'planejador' || chat.pai === de)
  )
  if (abertos.length < teto) {
    return null
  }
  const terminado = abertos.find(
    (chat) => !SITUACOES_ATIVAS.has(estado.ordens[chat.ordemId]?.situacao)
  )
  return terminado?.id ?? null
}

/** FR-20: ordens em espera que já cabem no teto, da mais antiga para a mais nova. */
export function ordensLiberadasDaEspera(estado) {
  const liberadas = []
  const simulado = { ...estado, ordens: { ...estado.ordens } }
  for (const ordem of Object.values(estado.ordens)) {
    if (ordem.situacao === 'em_espera' && vagaLivre(simulado, ordem.de, ordem.papel)) {
      liberadas.push(ordem.id)
      simulado.ordens[ordem.id] = { ...ordem, situacao: 'trabalhando' }
    }
  }
  return liberadas
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
