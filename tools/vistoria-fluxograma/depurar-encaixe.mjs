// Mostra como o encaixe chega ao arranjo de um caso: zoom, buraco e posicao de cada projeto (apoio, nao prova).
// Uso: node tools/vistoria-fluxograma/depurar-encaixe.mjs [indice-do-caso]
import { buracosEm, carregarCalculo, CASOS, projetosDoCaso } from './casos-encaixe.mjs'

const calculo = await carregarCalculo()
const caso = CASOS[Number(process.argv[2] ?? 0)]
const projetos = projetosDoCaso(caso)
const quadro = { w: 2151, h: 1370 }
const margens = { bottom: 64, pad: 32 }
const { boxes, headers } = calculo.layoutCanvas(projetos, quadro, margens)
const vista = calculo.fitView(calculo.drawnBounds(projetos, boxes), quadro, margens)
console.log(caso.nome, 'zoom', vista.s.toFixed(3))
for (const [id, h] of Object.entries(headers)) {
  console.log(`  ${id}: cabecalho (${Math.round(h.x)}, ${Math.round(h.y)})`)
}
console.log(
  'buraco',
  buracosEm(
    calculo,
    projetos,
    Object.fromEntries(Object.entries(headers).map(([id, h]) => [id, [h.x, h.y]]))
  )
)
import { writeFileSync } from 'node:fs'
import { contornosEm } from './casos-encaixe.mjs'
const cab = Object.fromEntries(Object.entries(headers).map(([id, h]) => [id, [h.x, h.y]]))
const saida = (cabecalhos) => {
  const { contornos, caixa } = contornosEm(calculo, projetos, cabecalhos)
  return {
    contornos,
    caixa,
    comFolgas: calculo.largestHole(contornos, caixa, calculo.PACK_RULES).rect,
    semFolgas: calculo.largestHole(contornos, caixa, { gapX: 0, gapY: 0 }).rect
  }
}
writeFileSync(
  process.argv[3] ?? 'esquema.json',
  JSON.stringify({ novo: saida(cab), mao: caso.mao ? saida(caso.mao) : saida(cab) })
)
