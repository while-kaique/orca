// Vistoria da juncao: monta a branch atual, abre um Orca de teste escondido com copia do estado guardado do
// Orca em uso, tira o print do fluxograma, confere o lado de cada card e fecha tudo sem deixar nada.
// Uso e detalhes: tools/vistoria-fluxograma/LEIAME.md
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  abrirFluxograma,
  abrirOrcaDeTeste,
  cardsNoLugarErrado,
  janelasVisiveisDoMundo,
  lerFluxograma,
  montarBranch,
  montarMundo,
  MUNDO_PADRAO,
  processosDoMundo,
  RAIZ
} from './orca-de-teste.mjs'

const argumentos = process.argv.slice(2)
const tem = (nome) => argumentos.includes(nome)
const valor = (nome) => {
  const indice = argumentos.indexOf(nome)
  return indice === -1 ? undefined : argumentos[indice + 1]
}
if (tem('--ajuda')) {
  console.log(
    'node tools/vistoria-fluxograma/vistoria-juncao.mjs [--sem-montar] [--saida PASTA] [--posicoes ARQUIVO.json] [--manter]'
  )
  process.exit(0)
}

const saida = path.resolve(
  valor('--saida') ?? path.join(RAIZ, '.cache', 'vistoria-fluxograma', 'juncao')
)
mkdirSync(saida, { recursive: true })
const linhas = []
const inicio = Date.now()
const segundos = () => ((Date.now() - inicio) / 1000).toFixed(1).padStart(6)
const dizer = (texto) => {
  const linha = `[${segundos()} s] ${texto}`
  linhas.push(linha)
  console.log(linha)
}

let defeitos = []
let sobras = []
let janelas = []
let erro = null
try {
  if (tem('--sem-montar')) {
    dizer('montagem pulada (--sem-montar): usando o que ja esta em out/')
  } else {
    dizer('montando a branch atual (cerca de 3 minutos)...')
    montarBranch(saida)
    dizer('montagem pronta')
  }
  dizer(`mundo de teste montado em ${montarMundo()}`)
  const orca = await abrirOrcaDeTeste({ registro: dizer, manter: tem('--manter') })
  try {
    const arquivoPosicoes = valor('--posicoes')
    if (arquivoPosicoes) {
      const posicoes = readFileSync(arquivoPosicoes, 'utf8')
      await orca.page.evaluate(
        (texto) => window.localStorage.setItem('orca-fork.canvas-offsets', texto),
        posicoes
      )
      await orca.page.reload()
      await orca.page.waitForFunction(() => window.__store?.getState().repos.length > 0, null, {
        timeout: 120_000
      })
      dizer(`posicoes guardadas trocadas por ${arquivoPosicoes}`)
    }
    await abrirFluxograma(orca.page)
    const fatos = await lerFluxograma(orca.page)
    writeFileSync(path.join(saida, 'fluxograma-fatos.json'), JSON.stringify(fatos, null, 2))
    await orca.page.screenshot({ path: path.join(saida, 'fluxograma.png') })
    dizer(`print salvo em ${path.join(saida, 'fluxograma.png')}`)
    for (const projeto of fatos.projetos) {
      dizer(
        `  ${projeto.nome}: ${projeto.cards.map((c) => `${c.papel ?? '?'}(${c.lado})`).join(' ')}`
      )
    }
    defeitos = arquivoPosicoes ? [] : cardsNoLugarErrado(fatos)
    janelas = janelasVisiveisDoMundo(MUNDO_PADRAO, [orca.pid])
    dizer(
      `processos do teste no ar: ${processosDoMundo(MUNDO_PADRAO, [orca.pid]).length}; janelas visiveis: ${janelas.length}`
    )
  } finally {
    sobras = await orca.fechar()
  }
} catch (falha) {
  erro = falha
}

sobras = [...sobras, ...processosDoMundo()]
dizer(`depois de fechar: ${sobras.length} processos do teste ainda vivos`)
for (const defeito of defeitos) {
  dizer(`DEFEITO: ${defeito}`)
}
if (erro) {
  dizer(`ERRO: ${erro.message}`)
}
dizer(
  erro || defeitos.length || sobras.length || janelas.length
    ? 'RESULTADO: ha o que olhar (acima)'
    : 'RESULTADO: tudo no lugar, nada sobrou'
)
writeFileSync(path.join(saida, 'rodada.txt'), linhas.join('\n'))
process.exit(erro || defeitos.length || sobras.length || janelas.length ? 1 : 0)
