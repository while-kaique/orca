// `hierarquia fechar`: quem criou fecha o chat de uma ordem sua, ligado ou dormindo (adendo 5 da o-021).
import { abasGuardadas } from './abas-do-orca.mjs'
import { citar, orca } from './orca-lancador.mjs'
import { vidaDoChat } from './regras.mjs'

const TERMINADA = new Set(['aprovado', 'liberado', 'esperando_kaique', 'parou'])

/** As ordens que o pedido fecha: uma, as terminadas do criador ou as terminadas de um pedido dele. */
export function ordensParaFechar(estado, eu, { ordem, terminados, pedido }) {
  if (ordem) {
    return [ordem]
  }
  return Object.values(estado.ordens)
    .filter(
      (o) =>
        o.de === eu && o.chatId && TERMINADA.has(o.situacao) && (terminados || o.pedido === pedido)
    )
    .map((o) => o.id)
}

/** O estado de cada chat do registro: ligado, dormindo, fechado. Map(id do chat -> vida). */
export async function vidaDosChats(estado) {
  const abas = await abasGuardadas()
  let terminais = []
  try {
    terminais = orca(['terminal', 'list']).result?.terminals ?? []
  } catch {
    // Sem o Orca, a vida sai só da sessão gravada.
  }
  const vidas = new Map()
  for (const chat of Object.values(estado.chats)) {
    vidas.set(chat.id, vidaDoChat(chat, terminais, abas))
  }
  return { vidas, abas, terminais }
}

function fecharUm(estado, ordem, { vidas, abas, terminais }, projeto) {
  const chat = estado.chats[ordem.chatId]
  const vida = vidas.get(chat.id)
  if (vida === 'ligado') {
    const terminal =
      terminais.find((t) => t.tabId === chat.id) ?? terminais.find((t) => t.handle === chat.handle)
    orca(['terminal', 'close', '--terminal', terminal.handle, '--tab'])
    return 'aba ligada fechada'
  }
  if (vida === 'dormindo') {
    const { pasta } = abas.get(chat.id)
    const vizinhas = [...abas.entries()].filter(
      ([id, aba]) => id !== chat.id && aba.pasta === pasta
    )
    // Aba dormindo só fecha com a pasta inteira: nunca numa pasta que tem outro chat.
    if (
      !pasta ||
      vizinhas.length > 0 ||
      pasta.replaceAll('\\', '/') === projeto.replaceAll('\\', '/')
    ) {
      return `NAO FECHADO: dorme numa pasta com outras ${vizinhas.length} aba(s); feche a aba pelo Orca`
    }
    orca(['terminal', 'close', '--worktree', citar(`path:${pasta}`), '--all'])
    return `aba dormindo fechada (pasta ${pasta} continua no disco)`
  }
  return vida === 'fechado'
    ? 'a aba ja nao existia'
    : 'sem terminal e sem sessao do Orca para conferir'
}

/** Fecha os chats das ordens pedidas, só as criadas por quem pede. Nunca remove pasta nem branch. */
export async function fecharChats({ projeto, estado, eu, ids, anotar }) {
  const vida = await vidaDosChats(estado)
  const linhas = []
  for (const id of ids) {
    const ordem = estado.ordens[id]
    if (!ordem || ordem.de !== eu) {
      linhas.push(`${id}: recusado, so quem criou a ordem fecha o chat dela`)
      continue
    }
    if (!ordem.chatId || !estado.chats[ordem.chatId]) {
      linhas.push(`${id}: a ordem nao tem chat`)
      continue
    }
    const resultado = fecharUm(estado, ordem, vida, projeto)
    if (!resultado.startsWith('NAO')) {
      anotar('chat_encerrado', {
        chatId: ordem.chatId,
        motivo: `fechado por quem criou: ${resultado}`
      })
    }
    linhas.push(`${id} (${vida.vidas.get(ordem.chatId)}): ${resultado}`)
  }
  return linhas
}
