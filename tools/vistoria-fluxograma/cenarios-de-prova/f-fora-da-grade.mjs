// Tipo f: depois do Reorganizar, um card puxado com o mouse fica fora da grade de 196 unidades.
export default async function () {}

export async function depoisDoReorganizar(page, { lerTela, dizer }) {
  const fatos = await lerTela()
  const card = fatos.cards.find((c) => c.tipo === 'chat' && c.forma === 'card')
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
