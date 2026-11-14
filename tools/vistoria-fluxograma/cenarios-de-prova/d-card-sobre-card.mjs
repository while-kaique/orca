// Tipo d: um card arrastado para cima de outro.
import { arrastar } from './ajudas.mjs'

export default async function (page, { lerTela, recarregar, dizer }) {
  const fatos = await lerTela()
  const chats = fatos.cards.filter((c) => c.tipo === 'chat' && c.forma === 'card')
  const [alvo, movido] = chats
  if (!alvo || !movido) {
    throw new Error('o cenario precisa de dois cards cheios (nem hexagono nem planejador)')
  }
  dizer(`arrastando ${movido.rotulo} para cima de ${alvo.rotulo}`)
  await arrastar(page, {
    [movido.chave]: {
      dx: alvo.caixa.x - movido.caixa.x + 40,
      dy: alvo.caixa.y - movido.caixa.y + 30
    }
  })
  await recarregar()
}
