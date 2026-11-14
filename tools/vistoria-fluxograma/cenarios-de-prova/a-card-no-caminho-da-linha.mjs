// Tipo a: um card arrastado para o meio do caminho de uma linha que nao e dele (a linha tem de desviar ou passar por dentro).
import { arrastar, centro } from './ajudas.mjs'

export default async function (page, { lerTela, recarregar, dizer }) {
  const fatos = await lerTela()
  const linha = fatos.linhas.find((l) => l.tipo !== 'seta' && l.comprimento > 200)
  if (!linha) {
    throw new Error('o cenario precisa de uma linha com mais de 200 unidades')
  }
  const meio = linha.pontos[Math.floor(linha.pontos.length / 2)]
  const perto = (card) => {
    const [cx, cy] = centro(card.caixa)
    return Math.hypot(cx - meio[0], cy - meio[1])
  }
  const candidatos = fatos.cards
    .filter((c) => c.tipo === 'chat' && c.forma === 'card')
    .sort((a, b) => perto(b) - perto(a))
  const movido = candidatos[0]
  if (!movido) {
    throw new Error('o cenario precisa de um card cheio fora da linha')
  }
  const [cx, cy] = centro(movido.caixa)
  dizer(
    `arrastando ${movido.rotulo} para o meio da linha em (${Math.round(meio[0])}, ${Math.round(meio[1])})`
  )
  await arrastar(page, { [movido.chave]: { dx: meio[0] - cx, dy: meio[1] - cy } })
  await recarregar()
}
