// Destrava a ordem que nasceu parada na caixa de texto do chat. Chamado pelo vigia do criador.
import { criarVigia } from './inicio-do-turno.mjs'
import { pedidoParaOrca, trechoDoPedido } from './pedido-da-ordem.mjs'
import { anotar, lerEventos } from './registro.mjs'
import { montarEstado } from './regras.mjs'

const tentativasDeDestravar = new Map()

/** Ordem do chat que nasceu com o pedido parado na caixa: o vigia confere a tela e envia, até 3 vezes. */
export async function destravarInicios(projeto, eu, log) {
  const estado = montarEstado(lerEventos(projeto))
  for (const ordem of Object.values(estado.ordens)) {
    const chat = estado.chats[ordem.chatId]
    const tentativas = tentativasDeDestravar.get(ordem.id) ?? 0
    if (
      ordem.de !== eu ||
      ordem.situacao !== 'trabalhando' ||
      !['nao_enviada', 'nao_confirmado'].includes(ordem.inicio) ||
      !chat?.ativo ||
      tentativas >= 3
    ) {
      continue
    }
    tentativasDeDestravar.set(ordem.id, tentativas + 1)
    const pedido = pedidoParaOrca(projeto, ordem.id, ordem.papel, ordem.campos)
    const vigia = criarVigia(trechoDoPedido(pedido))
    vigia.ligar(ordem.dispatchId, chat.handle)
    const resumo = await vigia.fechar((tipo, dados) =>
      anotar(projeto, tipo, {
        ordemId: ordem.id,
        chatId: chat.id,
        porVigiaDoCriador: true,
        ...dados
      })
    )
    log(`destravar ${ordem.id} (tentativa ${tentativas + 1}): ${resumo}`)
  }
}
