// Tipo g: um chat da hierarquia arrastado 6 colunas para a direita do dono dele.
import { arrastar } from './ajudas.mjs'

export default async function (page, { lerTela, recarregar, dizer }) {
  const fatos = await lerTela()
  const filho = fatos.cards.find(
    (c) => c.tipo === 'chat' && c.papel && c.papel !== 'free' && c.papel !== 'po'
  )
  if (!filho) {
    throw new Error('o cenario precisa de um planejador ou executor')
  }
  dizer(`arrastando ${filho.rotulo} 2400 unidades para a direita`)
  await arrastar(page, { [filho.chave]: { dx: 2400, dy: 0 } })
  await recarregar()
}
