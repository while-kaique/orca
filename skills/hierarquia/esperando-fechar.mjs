// Chats esperando o Kaique confirmar o fechamento (complemento da o-043, regra do Kaique de 13/11): enquanto houver
// chat de pedido entregue ainda aberto, ou chat parado cujo criador caiu, o PO pergunta em toda mensagem. A regra so
// no po.md foi esquecida 4 vezes; agora `hierarquia estado` mostra a linha fixa no topo, com a frase pronta.
import { NAO_TERMINADA, pedidosNoEstado } from './regras.mjs'

const ABERTO = new Set(['ligado', 'dormindo'])
const ESPERANDO_VALIDAR = new Set(['conferindo_plano', 'conferindo_produto', 'esperando_kaique'])

const oQueFez = (ordem) => {
  const titulo = String(ordem.campos?.titulo ?? ordem.campos?.objetivo ?? '').slice(0, 70)
  return `${ordem.id} (${ordem.papel}, ${ordem.situacao}): ${titulo}`
}

/**
 * `entregues`: ordens de pedido entregue com o chat ainda aberto. `orfaos`: ordens paradas (nao trabalhando, nao
 * esperando conferencia) com o chat aberto e o criador sem chat. Aberto = a aba existe (o card esta na tela), mesmo
 * que o registro ja de o chat como encerrado. `vidas`: Map(chatId -> ligado|dormindo|fechado).
 */
export function chatsEsperandoFechar(estado, vidas) {
  const aberta = (ordem) => {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    return Boolean(chat && ABERTO.has(vidas.get(chat.id)))
  }
  const entregues = pedidosNoEstado(estado)
    .filter((pedido) => pedido.situacao === 'entregue')
    .flatMap((pedido) => pedido.ordens.filter(aberta))
  const jaListadas = new Set(entregues.map((ordem) => ordem.id))
  const criadorCaiu = (ordem) => {
    const criador = estado.chats[ordem.de]
    return !criador || !ABERTO.has(vidas.get(criador.id))
  }
  const orfaos = Object.values(estado.ordens).filter(
    (ordem) =>
      !jaListadas.has(ordem.id) &&
      aberta(ordem) &&
      !NAO_TERMINADA.has(ordem.situacao) &&
      !ESPERANDO_VALIDAR.has(ordem.situacao) &&
      criadorCaiu(ordem)
  )
  return { entregues, orfaos }
}

/** As linhas do topo do estado e a frase que o PO repete ao Kaique; nada quando nao ha chat esperando. */
export function linhasEsperandoFechar({ entregues, orfaos }) {
  if (entregues.length === 0 && orfaos.length === 0) {
    return []
  }
  const linhas = [
    `ESPERANDO O KAIQUE CONFIRMAR O FECHAMENTO (${entregues.length + orfaos.length} chat(s)); pergunte em TODA mensagem ate ele responder:`
  ]
  for (const ordem of entregues) {
    linhas.push(`  * pedido entregue: ${oQueFez(ordem)}`)
  }
  for (const ordem of orfaos) {
    linhas.push(`  * parado, criador caiu: ${oQueFez(ordem)}`)
  }
  // A frase do po.md (regra de 13/11): o chat, o que ele fez, e "Posso fechar, ou voce fecha?".
  const nomes = (lista) =>
    lista
      .map((ordem) => `${ordem.id} (${String(ordem.campos?.titulo ?? ordem.id).slice(0, 50)})`)
      .join('; ')
  const partes = [
    entregues.length > 0
      ? `estes chats terminaram o seu objetivo e estao esperando ser fechados: ${nomes(entregues)}`
      : '',
    orfaos.length > 0 ? `estes pararam e quem os criou ja fechou: ${nomes(orfaos)}` : ''
  ].filter(Boolean)
  linhas.push(
    `  Frase para repetir: "Kaique, ${partes.join('. E ')}. Posso fechar, ou voce fecha?"`
  )
  return linhas
}
