// O que `hierarquia estado` escreve na tela: uma linha por ordem e a Fila do Kaique.

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

export function imprimirEstado(projeto, estado, fila) {
  console.log(`Projeto: ${projeto}`)
  console.log(`PO: ${estado.po ?? '(nenhum)'}`)
  for (const ordem of Object.values(estado.ordens)) {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    const colunas = [
      `- ${ordem.id}`,
      `${ordem.papel}${chat ? ` (${chat.modelo})` : ''}`,
      rotuloDaSituacao(ordem),
      `pedido por ${ordem.de}`,
      `chat ${ordem.chatId ?? '-'}${chat?.ativo === false ? ' (fechado)' : ''}`,
      ordem.campos.titulo ?? ordem.campos.objetivo.slice(0, 60),
      ordem.reprovacoes ? `reprovada ${ordem.reprovacoes}x` : '',
      chat?.mexidoPeloKaique ? 'mexido pelo Kaique' : '',
      situacaoDoLancamento(ordem)
    ]
    console.log(colunas.filter(Boolean).join(' | '))
  }
  console.log(`Fila do Kaique: ${fila.length}`)
  for (const item of fila) {
    console.log(
      `  * ${item.tipo} | ${item.ordemId ?? item.perguntaId} | ${item.resumo ?? item.texto ?? ''}`
    )
  }
}
