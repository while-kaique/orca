// Tipo f: depois do Reorganizar, um card puxado com o mouse fica fora da grade de 196 unidades do projeto dele.
// Puxa um chat livre: puxar um PO leva os filhos junto e o projeto inteiro continua na grade dele (o-042).
export default async function () {}

export async function depoisDoReorganizar(page, { lerTela, dizer }) {
  const fatos = await lerTela()
  const chats = fatos.cards.filter((c) => c.tipo === 'chat')
  const card = chats.find(
    (c) => c.papel === 'free' && chats.filter((o) => o.projeto === c.projeto).length > 1
  )
  if (!card) {
    throw new Error('o cenario precisa de um chat livre num projeto com mais de um chat')
  }
  const caixa = await page.locator(`[data-chat-key="${card.chave}"]`).boundingBox()
  const x = caixa.x + caixa.width / 2
  const y = caixa.y + caixa.height / 2
  dizer(`puxando ${card.rotulo} 37 px para o lado depois do Reorganizar`)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 20, y, { steps: 4 })
  await page.mouse.move(x + 37, y, { steps: 4 })
  await page.mouse.up()
}
