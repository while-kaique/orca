// O que `hierarquia estado` escreve na tela: o teto, as ordens agrupadas por pedido e a Fila do Kaique.
import { ocupacao, pedidosNoEstado } from './regras.mjs'

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
export function imprimirEstado(projeto, estado, fila) {
  console.log(`Projeto: ${projeto}`)
  console.log(`PO: ${estado.po ?? '(nenhum)'}`)
  console.log(linhaDoTeto(estado))
  const pedidos = pedidosNoEstado(estado)
  const fechados = pedidos.filter((p) => ['entregue', 'parado'].includes(p.situacao))
  if (fechados.length > 0) {
    console.log(
      `Pedidos fechados (${fechados.length}): ${fechados.map((p) => `${p.pedido} ${p.situacao}`).join('; ')}`
    )
  }
  for (const pedido of pedidos.filter((p) => !fechados.includes(p))) {
    console.log(`Pedido ${pedido.pedido}: ${pedido.situacao}`)
    for (const ordem of pedido.ordens) {
      imprimirOrdem(estado, ordem)
    }
  }
  console.log(`Fila do Kaique: ${fila.length}`)
  for (const item of fila) {
    console.log(
      `  * ${item.tipo} | ${item.ordemId ?? item.perguntaId} | ${item.resumo ?? item.texto ?? ''}`
    )
  }
}

function imprimirOrdem(estado, ordem) {
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
    `chat ${ordem.chatId ?? '-'}${chat?.ativo === false ? ' (fechado)' : ''}`,
    ordem.campos.titulo ?? ordem.campos.objetivo.slice(0, 60),
    ordem.reprovacoes ? `reprovada ${ordem.reprovacoes}x` : '',
    chat?.mexidoPeloKaique ? 'mexido pelo Kaique' : '',
    situacaoDoLancamento(ordem)
  ]
  console.log(colunas.filter(Boolean).join(' | '))
}
