// O que `hierarquia estado` escreve na tela: o teto, as ordens agrupadas por pedido e a Fila do Kaique.
import { vidaDosChats } from './fechar-chats.mjs'
import { orca } from './orca-lancador.mjs'
import { anotar, gravarFoto, lerEventos } from './registro.mjs'
import {
  filaDoKaique,
  GRACA_DO_LANCAMENTO_MS,
  montarEstado,
  OCUPA_VAGA,
  ocupacao,
  pedidosNoEstado
} from './regras.mjs'
import { marcarChatsMortos } from './vigia-do-criador.mjs'
import { ordensComComandoPreso } from './comando-preso.mjs'
import { estadosDosAgentes, olharPorta } from './porta-do-orca.mjs'

/** `hierarquia estado`: marca os chats mortos, regrava a foto e escreve o estado com a vida de cada chat. */
export async function comandoEstado(projeto, op) {
  try {
    const terminais = orca(['terminal', 'list']).result?.terminals ?? []
    if (terminais.length > 0) {
      marcarChatsMortos(montarEstado(lerEventos(projeto)), terminais, (tipo, dados) =>
        anotar(projeto, tipo, dados)
      )
    }
  } catch {
    // Sem o Orca, o estado sai só do registro.
  }
  const estado = montarEstado(lerEventos(projeto))
  gravarFoto(projeto)
  const [{ vidas }, porta] = await Promise.all([
    vidaDosChats(estado),
    olharPorta().catch(() => null)
  ])
  const presos = ordensComComandoPreso(estado, vidas, estadosDosAgentes())
  if (op.json) {
    const vida = Object.fromEntries(vidas)
    const comandosPresos = Object.fromEntries(presos)
    console.log(
      JSON.stringify({ estado, vida, fila: filaDoKaique(estado), porta, comandosPresos }, null, 2)
    )
    return
  }
  console.log(linhaDaPorta(porta))
  imprimirEstado(projeto, estado, filaDoKaique(estado), vidas, presos)
}

/** A coluna do comando preso: quanto tempo, qual comando e se quem criou ja foi avisado. */
function colunaDoComandoPreso(ordem, preso) {
  if (!preso) {
    return ''
  }
  const avisado = ordem.comandoPreso?.ferramentaId === preso.ferramentaId
  return `COMANDO PRESO? um comando de shell rodando ha ${preso.minutos} min sem nada novo (${preso.comando})${avisado ? '; quem criou ja foi avisado' : ''}`
}

/** A primeira linha do estado: o PO vê sem pedir se pode reabrir o Orca (detalhe em `hierarquia porta`). */
export function linhaDaPorta(porta) {
  if (!porta) {
    return 'Pode reabrir o Orca: nao sei (a porta nao respondeu; rode hierarquia porta)'
  }
  const liberacao = porta.liberacao
    ? ` | liberacao de reabrir em aberto desde ${porta.liberacao.desde}`
    : ''
  return `Pode reabrir o Orca: ${porta.resumo}${porta.pode ? '' : ' (detalhe: hierarquia porta)'}${liberacao}`
}

function situacaoDoLancamento(ordem) {
  if (ordem.lancamentoFalhou) {
    return `lançamento falhou: ${ordem.lancamentoFalhou.slice(0, 120)}`
  }
  return ordem.lancamento && ordem.lancamento !== 'ready' ? `lançamento ${ordem.lancamento}` : ''
}

const SEM_INICIO = {
  nao_enviada: (ordem) =>
    `ORDEM NAO ENVIADA: digitada no chat ${ordem.chatId}, falta enviar${ordem.inicioDesistido ? ' (o vigia desistiu: envie a tecla Enter nesse chat)' : ' (o vigia do criador continua tentando)'}`,
  nao_confirmado: (ordem) =>
    `inicio NAO confirmado no chat ${ordem.chatId} (a tela dele nao mostra a ordem enviada)${ordem.inicioDesistido ? '; o vigia desistiu' : ''}`,
  pendente: () => 'lancando (inicio ainda nao confirmado)'
}

/** `trabalhando` só vale para chat que comecou: sem a confirmação, a linha diz o que falta. */
export function rotuloDaSituacao(ordem, chat = null, vida = null, agora = Date.now()) {
  if (chat?.cortadoEm && !chat.retomadoEm && ordem.situacao === 'trabalhando') {
    return `CORTADO quando o Orca fechou: volta sozinho quando o Claude do chat abrir${chat.corteAvisado ? ' (aviso guardado)' : ''}`
  }
  // Caso de 13/11: antes de o vigia passar, chat sem terminal nao aparece como trabalhando (chat novo tem a graca).
  if (
    ['fechado', 'dormindo'].includes(vida) &&
    OCUPA_VAGA.has(ordem.situacao) &&
    agora - Date.parse(ordem.lancadoEm) >= GRACA_DO_LANCAMENTO_MS
  ) {
    return `SEM CHAT LIGADO (${vida}): nao esta trabalhando; o vigia de quem criou da como ${vida === 'dormindo' ? 'cortada' : 'parada'} em ate 2 min`
  }
  if (ordem.situacao === 'trabalhando' && ordem.inicio !== 'confirmado') {
    return (SEM_INICIO[ordem.inicio] ?? SEM_INICIO.pendente)(ordem)
  }
  return ordem.situacao
}

function linhaDoTeto(estado) {
  const { planejadores, executores, teto, emEspera } = ocupacao(estado)
  return `Teto: planejadores ${planejadores} de ${teto.planejadoresPorProjeto}, executores ${executores} de ${teto.executoresPorProjeto} trabalhando; esperando vaga: ${emEspera.length}`
}

/** Pedidos já terminados há tempo ficam numa linha só; os abertos mostram cada ordem. */
export function imprimirEstado(projeto, estado, fila, vidas, presos = new Map()) {
  console.log(`Projeto: ${projeto}`)
  const po = estado.po ? estado.chats[estado.po] : null
  console.log(`PO: ${estado.po ?? '(nenhum)'}${po ? ` (${vidaComAvisos(estado, po, vidas)})` : ''}`)
  console.log(linhaDoTeto(estado))
  const pedidos = pedidosNoEstado(estado)
  // Pedido terminado fica numa linha só, menos quando algum chat dele ainda tem aba (cartão na tela).
  const comAba = (p) => p.ordens.some((o) => ['ligado', 'dormindo'].includes(vidas.get(o.chatId)))
  const fechados = pedidos.filter((p) => ['entregue', 'parado'].includes(p.situacao) && !comAba(p))
  if (fechados.length > 0) {
    console.log(
      `Pedidos fechados (${fechados.length}): ${fechados.map((p) => `${p.pedido} ${p.situacao}`).join('; ')}`
    )
  }
  for (const pedido of pedidos.filter((p) => !fechados.includes(p))) {
    console.log(`Pedido ${pedido.pedido}: ${pedido.situacao}`)
    for (const ordem of pedido.ordens) {
      imprimirOrdem(estado, ordem, vidas, presos.get(ordem.id))
    }
  }
  console.log(`Fila do Kaique: ${fila.length}`)
  for (const item of fila) {
    console.log(
      `  * ${item.tipo} | ${item.ordemId ?? item.perguntaId} | ${item.resumo ?? item.texto ?? ''}`
    )
  }
}

/** A vida do chat e, quando ha, quantos avisos esperam o Claude dele abrir. */
function vidaComAvisos(estado, chat, vidas) {
  const guardados = Object.values(estado.guardados ?? {}).filter((a) => a.chatId === chat.id).length
  return guardados > 0
    ? `${vidas.get(chat.id)}, Claude fechado: ${guardados} aviso(s) guardado(s)`
    : vidas.get(chat.id)
}

function imprimirOrdem(estado, ordem, vidas, preso = null) {
  const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
  const colunas = [
    `  - ${ordem.id}`,
    `${ordem.papel}${chat ? ` (${chat.modelo})` : ''}`,
    rotuloDaSituacao(ordem, chat, chat ? vidas.get(chat.id) : null),
    colunaDoComandoPreso(ordem, preso),
    ordem.posicaoNaFila
      ? `${ordem.posicaoNaFila}o na fila${ordem.prioridade ? ' (passa na frente)' : ''}`
      : '',
    ordem.situacao === 'parou' && ordem.motivoDaParada
      ? `parada${ordem.paradaAutomatica ? ' sozinha' : ''}: ${ordem.motivoDaParada}`
      : '',
    `pedido por ${ordem.de}`,
    `chat ${ordem.chatId ?? '-'}${chat ? ` (${vidaComAvisos(estado, chat, vidas)})` : ''}`,
    ordem.campos.titulo ?? ordem.campos.objetivo.slice(0, 60),
    ordem.reprovacoes ? `reprovada ${ordem.reprovacoes}x` : '',
    chat?.mexidoPeloKaique ? 'mexido pelo Kaique' : '',
    situacaoDoLancamento(ordem)
  ]
  console.log(colunas.filter(Boolean).join(' | '))
}
