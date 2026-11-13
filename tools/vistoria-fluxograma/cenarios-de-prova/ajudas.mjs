// Ferramentas comuns dos cenarios de prova da vistoria (so para montar defeitos de proposito no app de teste).

export const chavesPorPapel = (fatos, papel) =>
  fatos.cards.filter((c) => c.tipo === 'chat' && c.papel === papel)

export async function guardarNoArmazenamento(page, chave, valor) {
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [chave, valor])
}

export async function lerDoArmazenamento(page, chave, padrao) {
  return page.evaluate(
    ([k, p]) => {
      try {
        return JSON.parse(window.localStorage.getItem(k) ?? 'null') ?? p
      } catch {
        return p
      }
    },
    [chave, padrao]
  )
}

/** Soma deslocamentos aos cards (formato de orca-fork.canvas-offsets). */
export async function arrastar(page, deslocamentos) {
  const atuais = await lerDoArmazenamento(page, 'orca-fork.canvas-offsets', {})
  for (const [chave, { dx, dy }] of Object.entries(deslocamentos)) {
    const antes = atuais[chave] ?? { dx: 0, dy: 0 }
    atuais[chave] = { dx: antes.dx + dx, dy: antes.dy + dy }
  }
  await guardarNoArmazenamento(page, 'orca-fork.canvas-offsets', atuais)
}

export const centro = (caixa) => [caixa.x + caixa.w / 2, caixa.y + caixa.h / 2]
