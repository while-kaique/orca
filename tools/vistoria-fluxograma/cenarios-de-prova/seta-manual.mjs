// Criterio 5: seta manual entre dois cards (um deles hexagono) depois de (a) Reorganizar, (b) arrastar um dos
// cards, (c) um chat novo nascer; com um dos cards fechado a seta some. Cada passo e medido pela vistoria.
import path from 'node:path'
import { chavesPorPapel, guardarNoArmazenamento } from './ajudas.mjs'

export default async function (page, { lerTela, recarregar, medir, dizer, saida }) {
  const fatos = await lerTela()
  const executores = chavesPorPapel(fatos, 'executor')
  const outro = fatos.cards.find(
    (c) => c.tipo === 'chat' && c.papel !== 'executor' && c.projeto === executores[0]?.projeto
  )
  if (executores.length < 2 || !outro) {
    throw new Error('o cenario precisa de dois executores e de outro chat no mesmo projeto')
  }
  const setas = [
    { a: outro.chave, b: executores[0].chave },
    { a: executores[0].chave, b: executores[1].chave }
  ]
  await guardarNoArmazenamento(page, 'orca-fork.canvas-cords', setas)
  await recarregar()
  const quantasSetas = () => page.locator('.cc-lines path.cc-cord').count()
  dizer(`setas guardadas no formato de antes: ${await quantasSetas()} desenhadas ao abrir`)
  await medir('seta: ao abrir (guardada de antes)', 'seta-0-ao-abrir', false)

  await page.locator('.cc-tidy').click()
  await page.waitForTimeout(2500)
  await medir('seta: (a) depois do Reorganizar', 'seta-a-reorganizar', true)

  const caixa = await page.locator(`[data-chat-key="${executores[0].chave}"]`).boundingBox()
  const x = caixa.x + caixa.width / 2
  const y = caixa.y + caixa.height / 2
  // Arrasta para um lugar vazio: soltar o card no caminho da linha de outro faz a linha desviar (outro defeito, tipo a).
  const outros = await page.evaluate((proprio) => {
    return [...document.querySelectorAll('[data-chat-key], .cc-project')]
      .filter((el) => el.dataset.chatKey !== proprio)
      .map((el) => el.getBoundingClientRect())
      .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }))
  }, executores[0].chave)
  const livre = ([dx, dy]) =>
    !outros.some(
      (o) =>
        caixa.x + dx - 60 < o.x + o.w &&
        o.x < caixa.x + dx + caixa.width + 60 &&
        caixa.y + dy - 60 < o.y + o.h &&
        o.y < caixa.y + dy + caixa.height + 60
    )
  const [dx, dy] = [
    [0, 160],
    [220, 120],
    [-220, 120],
    [0, -160],
    [220, 0],
    [-220, 0]
  ].find(livre) ?? [0, 160]
  dizer(`arrastando ${executores[0].rotulo} ${dx}, ${dy} px (lugar vazio)`)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 4, y + dy / 4, { steps: 5 })
  await page.mouse.move(x + dx, y + dy, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(800)
  await medir('seta: (b) depois de arrastar um dos cards', 'seta-b-arrastar', false)

  // (c) um chat novo nasce no mesmo projeto (aba de teste, sem terminal).
  await page.evaluate((modelo) => {
    window.__store.setState((s) => {
      const tabsByWorktree = { ...s.tabsByWorktree }
      for (const [pasta, abas] of Object.entries(tabsByWorktree)) {
        const base = abas.find((aba) => aba.id === modelo)
        if (base) {
          tabsByWorktree[pasta] = [
            ...abas,
            {
              ...base,
              id: 'TESTE-chat-novo',
              ptyId: null,
              title: 'TESTE chat novo',
              customTitle: 'TESTE chat novo',
              generatedTitle: null
            }
          ]
        }
      }
      return { tabsByWorktree }
    })
  }, outro.chave)
  await page.waitForTimeout(2500)
  await medir('seta: (c) depois de um chat novo nascer', 'seta-c-chat-novo', false)

  // Com um dos dois cards fechado a seta nao aparece.
  const antes = await quantasSetas()
  await page.evaluate((fechado) => {
    window.__store.setState((s) => ({
      tabsByWorktree: Object.fromEntries(
        Object.entries(s.tabsByWorktree).map(([pasta, abas]) => [
          pasta,
          abas.filter((aba) => aba.id !== fechado)
        ])
      )
    }))
  }, executores[1].chave)
  await page.waitForTimeout(1500)
  dizer(`setas desenhadas antes de fechar um dos cards: ${antes}; depois: ${await quantasSetas()}`)
  await page.screenshot({ path: path.join(saida, 'seta-d-card-fechado.png') })
}
