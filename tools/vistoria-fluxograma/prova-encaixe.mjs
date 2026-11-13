// Prova de numeros do encaixe (o-036): card do PO, buraco e tempo do Reorganizar nos casos dos prints a mao.
// Uso: node tools/vistoria-fluxograma/prova-encaixe.mjs [--saida ARQUIVO.json]
// E o CALCULO real (nao o programa aberto): serve de apoio, a prova no programa de verdade e prova-encaixe-real.mjs.
import { writeFileSync } from 'node:fs'
import { buracosEm, carregarCalculo, CASOS, projetosDoCaso } from './casos-encaixe.mjs'

const calculo = await carregarCalculo()
const { layoutCanvas, drawnBounds, fitView } = calculo

const quadro = { w: 2151, h: 1370 }
const margens = { bottom: 64, pad: 32 }
const resultado = { quadro, margens, casos: [] }
for (const caso of CASOS) {
  const projetos = projetosDoCaso(caso)
  const { boxes, headers } = layoutCanvas(projetos, quadro, margens)
  const vista = fitView(drawnBounds(projetos, boxes), quadro, margens)
  const po = Math.round(vista.s * 340 * 10) / 10
  const buracoNovo = buracosEm(
    calculo,
    projetos,
    Object.fromEntries(Object.entries(headers).map(([id, h]) => [id, [h.x, h.y]]))
  )
  const buracoMao = caso.mao ? buracosEm(calculo, projetos, caso.mao) : null
  resultado.casos.push({
    nome: caso.nome,
    poPx: po,
    poPxMao: caso.poMao,
    zoom: Math.round(vista.s * 1000) / 1000,
    buracoNovo,
    buracoMao
  })
  console.log(`${caso.nome}: card do PO ${po} px (a mao ${caso.poMao}) zoom ${vista.s.toFixed(3)}`)
  console.log(
    `   maior buraco em cards (com folgas / sem folgas): novo ${buracoNovo.comFolgas} / ${buracoNovo.semFolgas}; a mao ${buracoMao ? `${buracoMao.comFolgas} / ${buracoMao.semFolgas}` : 'sem arrumacao a mao'}`
  )
}

const projeto = (id) => ({
  id,
  name: id,
  color: '',
  initials: '',
  detail: '',
  queue: [],
  chats: [
    ['po', 'po', null, 1],
    ['plan', 'planejador', 'po'],
    ['e1', 'executor', 'plan'],
    ['e2', 'executor', 'plan'],
    ['e3', 'executor', 'po']
  ].map(([chave, tipo, pai, selos = 0]) => ({
    key: `${id}-${chave}`,
    projectId: id,
    worktreeId: 'w',
    tabId: chave,
    cwd: '',
    paneKey: null,
    ptyId: null,
    startedAt: 0,
    title: chave,
    parentKey: pai ? `${id}-${pai}` : null,
    model: null,
    transcriptPath: null,
    hierarchy: { role: tipo, order: null, toCheck: 0, touchedByUser: false },
    status: 'idle',
    lines: [],
    agents: [],
    extras: Array.from({ length: selos }, (_, i) => ({
      id: `${id}-${chave}-${i}`,
      kind: 'artifact',
      label: '',
      url: ''
    }))
  }))
})
const oito = Array.from({ length: 8 }, (_, i) => projeto(`p${i}`))
layoutCanvas(oito, quadro, margens)
const tempos = []
for (let i = 0; i < 10; i++) {
  const inicio = performance.now()
  layoutCanvas(oito, quadro, margens)
  tempos.push(performance.now() - inicio)
}
const ordenados = [...tempos].sort((a, b) => a - b)
const seis = oito.slice(0, 6)
const t6 = []
for (let i = 0; i < 5; i++) {
  const inicio = performance.now()
  layoutCanvas(seis, quadro, margens)
  t6.push(performance.now() - inicio)
}
resultado.tempo = {
  projetos: 8,
  chats: 40,
  medianaMs: Math.round(ordenados[5] * 10) / 10,
  piorMs: Math.round(ordenados[9] * 10) / 10,
  seisProjetosPiorMs: Math.round(Math.max(...t6) * 10) / 10
}
console.log(
  `8 projetos e 40 chats: mediana ${resultado.tempo.medianaMs} ms, pior ${resultado.tempo.piorMs} ms (limite 200 ms)`
)
console.log(`6 projetos (busca completa de ordem): pior ${resultado.tempo.seisProjetosPiorMs} ms`)
const i = process.argv.indexOf('--saida')
if (i !== -1) {
  writeFileSync(process.argv[i + 1], JSON.stringify(resultado, null, 2))
}
