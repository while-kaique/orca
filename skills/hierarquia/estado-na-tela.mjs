// O que `hierarquia estado` escreve na tela: o teto, as ordens agrupadas por pedido e a Fila do Kaique.
import { vidaDosChats } from './fechar-chats.mjs'
import { orca } from './orca-lancador.mjs'
import { anotar, gravarFoto, lerEventos } from './registro.mjs'
import { filaDoKaique, montarEstado, ocupacao, pedidosNoEstado } from './regras.mjs'
import { marcarChatsMortos } from './vigia-do-criador.mjs'

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
  const { vidas } = await vidaDosChats(estado)
  if (op.json) {
    const vida = Object.fromEntries(vidas)
    console.log(JSON.stringify({ estado, vida, fila: filaDoKaique(estado) }, null, 2))
    return
  }
  imprimirEstado(projeto, estado, filaDoKaique(estado), vidas)
}

function situacaoDoLancamento(ordem) {
  if (ordem.lancamentoFalhou) {
    return `lançamento falhou: ${ordem.lancamentoFalhou.slice(0, 120)}`
  }
  return ordem.lancamento && ordem.lancamento !== 'ready' ? `lançamento ${ordem.lancamento}` : ''
}

const SEM_INICIO = {
  nao_enviada: 'ORDEM NAO ENVIADA (parada na caixa de texto do chat)',
  nao_confirmado: 'inicio NAO confirmado (a tela do chat nao mostra a ordem enviada)',
  pendente: 'lancando (inicio ainda nao confirmado)'
}

/** `trabalhando` só vale para chat que comecou: sem a confirmação, a linha diz o que falta. */
export function rotuloDaSituacao(ordem) {
  if (ordem.situacao === 'trabalhando' && ordem.inicio !== 'confirmado') {
    return SEM_INICIO[ordem.inicio] ?? SEM_INICIO.pendente
  }
  return ordem.situacao
}

function linhaDoTeto(estado) {
  const { planejadores, executores, teto, emEspera } = ocupacao(estado)
  return `Teto: planejadores ${planejadores} de ${teto.planejadoresPorProjeto}, executores ${executores} de ${teto.executoresPorProjeto} trabalhando; esperando vaga: ${emEspera.length}`
}

/** Pedidos já terminados há tempo ficam numa linha só; os abertos mostram cada ordem. */
export function imprimirEstado(projeto, estado, fila, vidas) {
  console.log(`Projeto: ${projeto}`)
  console.log(`PO: ${estado.po ?? '(nenhum)'}`)
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
      imprimirOrdem(estado, ordem, vidas)
    }
  }
  console.log(`Fila do Kaique: ${fila.length}`)
  for (const item of fila) {
    console.log(
      `  * ${item.tipo} | ${item.ordemId ?? item.perguntaId} | ${item.resumo ?? item.texto ?? ''}`
    )
  }
}

function imprimirOrdem(estado, ordem, vidas) {
  const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
  const colunas = [
    `  - ${ordem.id}`,
    `${ordem.papel}${chat ? ` (${chat.modelo})` : ''}`,
    rotuloDaSituacao(ordem),
    ordem.posicaoNaFila
      ? `${ordem.posicaoNaFila}o na fila${ordem.prioridade ? ' (passa na frente)' : ''}`
      : '',
    ordem.situacao === 'parou' && ordem.motivoDaParada
      ? `parada${ordem.paradaAutomatica ? ' sozinha' : ''}: ${ordem.motivoDaParada}`
      : '',
    `pedido por ${ordem.de}`,
    `chat ${ordem.chatId ?? '-'}${chat ? ` (${vidas.get(chat.id)})` : ''}`,
    ordem.campos.titulo ?? ordem.campos.objetivo.slice(0, 60),
    ordem.reprovacoes ? `reprovada ${ordem.reprovacoes}x` : '',
    chat?.mexidoPeloKaique ? 'mexido pelo Kaique' : '',
    situacaoDoLancamento(ordem)
  ]
  console.log(colunas.filter(Boolean).join(' | '))
}
