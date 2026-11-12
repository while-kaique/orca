// Destrava a ordem cujo chat nasceu sem começar (texto parado na caixa, ou comando que morreu). Chamado pelo vigia do criador.
import { criarVigia } from './inicio-do-turno.mjs'
import { escreverNoChat } from './orca-lancador.mjs'
import { pedidoParaOrca, trechoDoPedido } from './pedido-da-ordem.mjs'
import { anotar, lerEventos } from './registro.mjs'
import { montarEstado, ordensSemInicio } from './regras.mjs'

const RODADA_MS = 60000
/** Um conferidor por ordem, com a memória dos envios: o limite de envios vale para o vigia inteiro, não por rodada. */
const conferidores = new Map()

function conferidorDa(projeto, ordem, chat) {
  let vigia = conferidores.get(ordem.id)
  if (!vigia) {
    vigia = criarVigia(trechoDoPedido(pedidoParaOrca(projeto, ordem.id, ordem.papel, ordem.campos)))
    conferidores.set(ordem.id, vigia)
  }
  vigia.ligar(ordem.dispatchId, chat.handle, chat.id)
  return vigia
}

/** Insiste em cada chat que não começou, sem nunca enviar a quem já trabalha; passado o prazo, avisa o criador do que falta. */
export async function destravarInicios(projeto, eu, log) {
  const estado = montarEstado(lerEventos(projeto))
  const { tentar, desistir } = ordensSemInicio(estado, eu, Date.now())
  for (const ordem of desistir) {
    const chat = estado.chats[ordem.chatId]
    const vigia = conferidorDa(projeto, ordem, chat)
    await vigia.passo()
    const notar = (tipo, dados) =>
      anotar(projeto, tipo, {
        ordemId: ordem.id,
        chatId: chat.id,
        porVigiaDoCriador: true,
        ...dados
      })
    if (vigia.comecou()) {
      vigia.registrar(notar)
    } else {
      vigia.registrar(notar, { desistiu: true })
      void escreverNoChat(
        estado.chats[eu]?.handle ?? process.env.ORCA_TERMINAL_HANDLE,
        `ORDEM ${ordem.id}: ${vigia.resumo()}`
      )
    }
    conferidores.delete(ordem.id)
    log(`desistiu ${ordem.id}: ${vigia.resumo()}`)
  }
  for (const ordem of tentar) {
    const chat = estado.chats[ordem.chatId]
    const vigia = conferidorDa(projeto, ordem, chat)
    await vigia.esperar(RODADA_MS)
    const notar = (tipo, dados) =>
      anotar(projeto, tipo, {
        ordemId: ordem.id,
        chatId: chat.id,
        porVigiaDoCriador: true,
        ...dados
      })
    // Só a primeira rodada sem sucesso declara a ordem sem início (o comando morreu); as outras só gravam quando o chat começa.
    if (vigia.comecou() || ordem.inicio === 'pendente') {
      vigia.registrar(notar)
    }
    log(`destravar ${ordem.id}: ${vigia.resumo()}`)
    if (vigia.comecou()) {
      conferidores.delete(ordem.id)
    }
  }
}
