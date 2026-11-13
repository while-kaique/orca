// Prova de numeros do encaixe (o-036): largura do card do PO nos casos dos prints a mao e tempo do Reorganizar.
// Uso: node tools/vistoria-fluxograma/prova-encaixe.mjs [--saida ARQUIVO.json]
// Empacota o calculo real (canvas-chats-layout.ts e vizinhos) com esbuild e roda aqui, sem abrir o Orca.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const raiz = path.resolve(import.meta.dirname, '..', '..')
const pasta = mkdtempSync(path.join(tmpdir(), 'prova-encaixe-'))
const entrada = path.join(pasta, 'entrada.ts')
const base = path
  .join(raiz, 'src', 'renderer', 'src', 'components', 'canvas-chats')
  .replaceAll('\\', '/')
writeFileSync(
  entrada,
  `export * from '${base}/canvas-chats-arrangement'\nexport * from '${base}/canvas-chats-fit'\n`
)
const saidaJs = path.join(pasta, 'encaixe.mjs')
await build({
  entryPoints: [entrada],
  outfile: saidaJs,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'error'
})
const { layoutCanvas, drawnBounds, fitView } = await import(pathToFileURL(saidaJs).href)

const chat = (id, [chave, tipo, pai, selos = 0]) => ({
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
  hierarchy:
    tipo === 'livre' ? null : { role: tipo, order: null, toCheck: 0, touchedByUser: false },
  status: 'idle',
  lines: [],
  agents: [],
  extras: Array.from({ length: selos }, (_, i) => ({
    id: `${id}-${chave}-${i}`,
    kind: 'artifact',
    label: '',
    url: ''
  }))
})
const projeto = (id, chats) => ({
  id,
  name: id,
  color: '',
  initials: '',
  detail: '',
  chats: chats.map((c) => chat(id, c)),
  queue: []
})

const astra = projeto('astra', [
  ['free', 'livre', null, 1],
  ['po', 'po'],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan']
])
const social4 = projeto('social', [
  ['po', 'po', null, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan'],
  ['e3', 'executor', 'po'],
  ['e4', 'executor', 'po', 1],
  ['e5', 'executor', 'po', 1]
])
const orca1 = projeto('orca', [['po', 'po']])
const so = projeto('so', [['free', 'livre']])
const orca3 = projeto('orca', [
  ['po', 'po', null, 1],
  ['e1', 'executor', 'po'],
  ['e2', 'executor', 'po']
])
const social3a = projeto('social', [
  ['po', 'po', null, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'po']
])
const social3b = projeto('social', [
  ['po', 'po', null, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan'],
  ['e3', 'executor', 'po', 1],
  ['e4', 'executor', 'po', 1]
])

const quadro = { w: 2151, h: 1370 }
const margens = { bottom: 64, pad: 32 }
const casos = [
  ['4 projetos (print a mao: PO 209 px)', [astra, orca1, so, social4], 209],
  ['3 projetos caso 1 (print a mao: PO 278 px)', [orca3, social3a, astra], 278],
  ['3 projetos caso 2 (print a mao: PO 242 px)', [social3b, orca3, astra], 242]
]
const resultado = { quadro, margens, casos: [] }
for (const [nome, projetos, mao] of casos) {
  const { boxes } = layoutCanvas(projetos, quadro, margens)
  const vista = fitView(drawnBounds(projetos, boxes), quadro, margens)
  const po = Math.round(vista.s * 340 * 10) / 10
  resultado.casos.push({ nome, poPx: po, poPxMao: mao, zoom: Math.round(vista.s * 1000) / 1000 })
  console.log(`${nome}: card do PO ${po} px (a mao ${mao}) zoom ${vista.s.toFixed(3)}`)
}

const oito = Array.from({ length: 8 }, (_, i) =>
  projeto(`p${i}`, [
    ['po', 'po', null, 1],
    ['plan', 'planejador', 'po'],
    ['e1', 'executor', 'plan'],
    ['e2', 'executor', 'plan'],
    ['e3', 'executor', 'po']
  ])
)
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
