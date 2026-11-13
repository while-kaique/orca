// Os 3 casos dos prints arrumados a mao pelo Kaique (12/11/2026), como dado: a forma de chats de cada projeto e
// onde ele pos o cabecalho de cada um. Usado pela prova de numeros (prova-encaixe.mjs) e pela prova no programa de verdade.
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const raiz = path.resolve(import.meta.dirname, '..', '..')
const base = path
  .join(raiz, 'src', 'renderer', 'src', 'components', 'canvas-chats')
  .replaceAll('\\', '/')

/** Empacota o calculo real do fluxograma (esbuild) e devolve as funcoes, para rodar sem abrir o Orca. */
export async function carregarCalculo() {
  const pasta = mkdtempSync(path.join(tmpdir(), 'calculo-encaixe-'))
  const entrada = path.join(pasta, 'entrada.ts')
  writeFileSync(
    entrada,
    [
      'canvas-chats-arrangement',
      'canvas-chats-fit',
      'canvas-chats-holes',
      'canvas-chats-packing',
      'canvas-chats-pack-search'
    ]
      .map((nome) => `export * from '${base}/${nome}'`)
      .concat(`export { planBlocks, PACK_RULES } from '${base}/canvas-chats-layout'`)
      .join('\n')
  )
  const saidaJs = path.join(pasta, 'calculo.mjs')
  await build({
    entryPoints: [entrada],
    outfile: saidaJs,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'error'
  })
  return import(pathToFileURL(saidaJs).href)
}

// [chave, tipo, pai, selos]: tipo livre|po|planejador|executor; pai e a chave do chat que criou este.
const astra = [
  ['livre', 'livre', null, 1],
  ['po', 'po'],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan']
]
const social4 = [
  ['po', 'po', null, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan'],
  ['e3', 'executor', 'po'],
  ['e4', 'executor', 'po', 1],
  ['e5', 'executor', 'po', 1]
]
const orca1 = [['po', 'po']]
const so = [['livre', 'livre']]
const orca3 = [
  ['po', 'po', null, 1],
  ['e1', 'executor', 'po'],
  ['e2', 'executor', 'po']
]
const social3a = [
  ['po', 'po', null, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'po']
]
const social3b = [
  ['po', 'po', null, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan'],
  ['e3', 'executor', 'po', 1],
  ['e4', 'executor', 'po', 1]
]

// Print de 13/11 "margens grandes demais" (Reorganizar antigo, 5 projetos; o quinto, Sistemas Operacionais, fica fora do
// recorte do print e e lido do estado real do dia).
const orca5 = [
  ['po', 'po'],
  ['plan1', 'planejador', 'po'],
  ['plan2', 'planejador', 'po'],
  ['e1', 'executor', 'po']
]
const social5 = [
  ['po', 'po', null, 1],
  ['plan1', 'planejador', 'po'],
  ['plan2', 'planejador', 'po'],
  ['e1', 'executor', 'plan1'],
  ['e2', 'executor', 'plan1'],
  ['e3', 'executor', 'po', 1],
  ['e4', 'executor', 'po', 1]
]

/**
 * `mao`: o cabecalho de cada projeto como o Kaique deixou, em unidades do desenho relativas ao primeiro projeto (medido nos
 * prints exibidos a 2420 px de largura, card do PO = 340 unidades; erro de leitura de cerca de 3 px de tela).
 * `poMao`: largura do card do PO no print dele, em px do tamanho real (2559): o quadro do fluxograma mede 2151 x 1370.
 */
export const CASOS = [
  {
    id: 'caso-4-projetos',
    nome: '4 projetos (12/11 23:47)',
    poMao: 209,
    projetos: [
      { id: 'astra', chats: astra },
      { id: 'orca', chats: orca1 },
      { id: 'so', chats: so },
      { id: 'social', chats: social4 }
    ],
    mao: { astra: [0, 0], orca: [661.5, -312.5], so: [1282.6, 10.4], social: [659.7, 569.4] }
  },
  {
    id: 'caso-3-projetos-a',
    nome: '3 projetos, caso 1 (12/11 17:56)',
    poMao: 278,
    projetos: [
      { id: 'orca', chats: orca3 },
      { id: 'social', chats: social3a },
      { id: 'astra', chats: astra }
    ],
    mao: { orca: [0, 0], social: [885.8, 7.8], astra: [1844.7, 76.5] }
  },
  {
    id: 'caso-3-projetos-b',
    nome: '3 projetos, caso 2 (12/11 21:11)',
    poMao: 242,
    projetos: [
      { id: 'social', chats: social3b },
      { id: 'orca', chats: orca3 },
      { id: 'astra', chats: astra }
    ],
    mao: { social: [0, 0], astra: [1053.7, 329.4], orca: [-13.4, 1045] }
  },
  {
    id: 'caso-5-projetos',
    nome: '5 projetos (13/11, margens grandes demais)',
    poMao: null,
    projetos: [
      { id: 'orca', chats: orca5 },
      { id: 'astra', chats: astra },
      { id: 'social', chats: social5 },
      { id: 'projetos', chats: [['livre', 'livre']] },
      { id: 'so', chats: so }
    ],
    mao: null
  }
]

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

/** Os projetos do caso no formato do calculo do fluxograma. `semSelos` tira os selos (o Orca de teste nao tem como cria-los). */
export const projetosDoCaso = (caso, { semSelos = false } = {}) =>
  caso.projetos.map(({ id, chats }) => ({
    id,
    name: id,
    color: '',
    initials: '',
    detail: '',
    chats: chats.map(([chave, tipo, pai, selos]) =>
      chat(id, [chave, tipo, pai, semSelos ? 0 : selos])
    ),
    queue: []
  }))

/** Contornos de cada projeto com o cabecalho em `cabecalhos[id] = [x, y]`, e a caixa que os cobre. */
export function contornosEm(calculo, projetos, cabecalhos) {
  const contornos = []
  for (const plano of calculo.planBlocks(projetos)) {
    const h = cabecalhos[plano.block.project.id]
    for (const r of plano.shape) {
      contornos.push({
        x: r.x + h[0] - plano.header.x,
        y: r.y + h[1] - plano.header.y,
        w: r.w,
        h: r.h
      })
    }
  }
  const x0 = Math.min(...contornos.map((r) => r.x))
  const y0 = Math.min(...contornos.map((r) => r.y))
  const caixa = {
    x: x0,
    y: y0,
    w: Math.max(...contornos.map((r) => r.x + r.w)) - x0,
    h: Math.max(...contornos.map((r) => r.y + r.h)) - y0
  }
  return { contornos, caixa }
}

/** O maior espaco vazio dentro da caixa do desenho, em cards de 340 x 230: com as folgas 104/80 e sem folga. */
export function buracosEm(calculo, projetos, cabecalhos) {
  const { contornos, caixa } = contornosEm(calculo, projetos, cabecalhos)
  const arredondar = (n) => Math.round(n * 100) / 100
  return {
    comFolgas: arredondar(calculo.largestHole(contornos, caixa, calculo.PACK_RULES).cards),
    semFolgas: arredondar(calculo.largestHole(contornos, caixa, { gapX: 0, gapY: 0 }).cards)
  }
}
