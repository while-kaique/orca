// Calculo (apoio, nao prova): distancia de cada projeto ao vizinho mais proximo, buraco, card do PO e tempo.
// Uso: node tools/vistoria-fluxograma/vaos-encaixe.mjs [--saida ARQUIVO.json]
import { writeFileSync } from 'node:fs'
import { buracosEm, carregarCalculo, CASOS, contornosEm, projetosDoCaso } from './casos-encaixe.mjs'

const calculo = await carregarCalculo()
const quadro = { w: 2151, h: 1370 }
const margens = { bottom: 64, pad: 32 }
const saida = []
for (const caso of CASOS) {
  const projetos = projetosDoCaso(caso)
  const inicio = performance.now()
  const { boxes, headers } = calculo.layoutCanvas(projetos, quadro, margens)
  const ms = performance.now() - inicio
  const vista = calculo.fitView(calculo.drawnBounds(projetos, boxes), quadro, margens)
  const cabecalhos = Object.fromEntries(Object.entries(headers).map(([id, h]) => [id, [h.x, h.y]]))
  const porProjeto = {}
  for (const p of projetos) {
    const so = contornosEm(calculo, [p], cabecalhos).contornos
    porProjeto[p.id] = so
  }
  const vaos = Object.entries(porProjeto).map(([id, rects]) => {
    const outros = Object.entries(porProjeto)
      .filter(([o]) => o !== id)
      .flatMap(([, r]) => r)
    return [id, Math.round(calculo.nearestGap(rects, outros) * 10) / 10]
  })
  const numeros = vaos.map(([, v]) => v)
  const linha = {
    caso: caso.id,
    poPx: Math.round(vista.s * 340 * 10) / 10,
    vaoMaisProximoPorProjeto: Object.fromEntries(vaos),
    menorVao: Math.min(...numeros),
    maiorVao: Math.max(...numeros),
    menorVaoPx: Math.round(Math.min(...numeros) * vista.s * 10) / 10,
    maiorVaoPx: Math.round(Math.max(...numeros) * vista.s * 10) / 10,
    buraco: buracosEm(calculo, projetos, cabecalhos),
    ms: Math.round(ms)
  }
  saida.push(linha)
  console.log(JSON.stringify(linha))
}
const i = process.argv.indexOf('--saida')
if (i > 0) {
  writeFileSync(process.argv[i + 1], JSON.stringify(saida, null, 2))
}
