// Vistoria do fluxograma: monta a branch, abre o Orca de teste escondido com copia do estado real, tira o
// print do fluxograma COMO ESTA e DEPOIS DE CLICAR no Reorganizar, mede os defeitos visuais pelas posicoes
// lidas da tela e termina com saida 1 e a lista do que achou, ou saida 0 e "zero achado".
// Uso e detalhes: tools/vistoria-fluxograma/LEIAME.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  abrirFluxograma,
  abrirOrcaDeTeste,
  janelasVisiveisDoMundo,
  montarBranch,
  montarMundo,
  MUNDO_PADRAO,
  processosDoMundo,
  RAIZ
} from './orca-de-teste.mjs'
import { lerTela } from './vistoria-leitura-da-tela.mjs'
import { analisar } from './vistoria-regras.mjs'

const argumentos = process.argv.slice(2)
const tem = (nome) => argumentos.includes(nome)
const valor = (nome) => {
  const indice = argumentos.indexOf(nome)
  return indice === -1 ? undefined : argumentos[indice + 1]
}
if (tem('--ajuda')) {
  console.log(
    [
      'node tools/vistoria-fluxograma/vistoria.mjs [opcoes]',
      '  --sem-montar            usa o que ja esta em out/ (so se a branch nao mudou desde a ultima montagem)',
      '  --app PASTA             abre o app montado nessa pasta (precisa de package.json e out/); implica --sem-montar',
      '  --saida PASTA           onde guardar prints, fatos.json e relato (padrao .cache/vistoria-fluxograma/vistoria)',
      '  --posicoes ARQUIVO.json cards arrastados (formato de orca-fork.canvas-offsets) para montar cenario de prova',
      '  --cordas ARQUIVO.json   setas guardadas (formato de orca-fork.canvas-cords) para montar cenario de prova',
      '  --cenario ARQUIVO.mjs   modulo com `export default async (page, ferramentas) => {}` que monta um cenario de prova no app de teste',
      '  --janela 2400x1500      tamanho da janela escondida em px (padrao 1500x950)',
      '  --zoom 0.35,1           alem das duas passadas, mede de novo em cada zoom listado (depois do Reorganizar)',
      '  --manter                nao apaga o mundo de teste no fim'
    ].join('\n')
  )
  process.exit(0)
}

const saida = path.resolve(
  valor('--saida') ?? path.join(RAIZ, '.cache', 'vistoria-fluxograma', 'vistoria')
)
mkdirSync(saida, { recursive: true })
const relato = []
const inicio = Date.now()
const dizer = (texto) => {
  const linha = `[${((Date.now() - inicio) / 1000).toFixed(1).padStart(6)} s] ${texto}`
  relato.push(linha)
  console.log(linha)
}

const NOME_DO_TIPO = {
  a: 'a) linha por dentro/colada/contornando card',
  b: 'b) ponta de linha ou seta fora do contorno',
  c: 'c) texto cortado ou fora da borda',
  d: 'd) card sobre card',
  e: 'e) selo longe do card',
  f: 'f) card fora da grade de 196',
  g: 'g) chat a mais de 3 colunas do dono'
}

const pedirPagina = async (page, chave, arquivo) => {
  if (!arquivo) {
    return false
  }
  const texto = readFileSync(arquivo, 'utf8')
  await page.evaluate(([k, t]) => window.localStorage.setItem(k, t), [chave, texto])
  return true
}

async function esperarAssentar(page, ms = 2500) {
  await page.waitForTimeout(ms)
}

async function ajustarZoom(page, alvo) {
  const zoomAtual = () =>
    page.evaluate(
      () => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.cc-world')).transform).a
    )
  const centro = await page.evaluate(() => {
    const r = document.querySelector('.cc-board').getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  // A roda do mouse nao anda exatamente o que se pede: confere e corrige ate chegar a 5% do zoom pedido.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const atual = await zoomAtual()
    if (Math.abs(atual - alvo) / alvo < 0.05) {
      break
    }
    await page.mouse.move(centro.x, centro.y)
    await page.mouse.wheel(0, -Math.log(alvo / atual) / 0.0015 / (tentativa === 0 ? 1.5 : 1))
    await esperarAssentar(page, 1200)
  }
  await centralizarNoPrimeiroProjeto(page)
}

/** Puxa o fundo do fluxograma ate o card ficar no meio da tela (um clique no fundo vazio do canto, arrastando). */
async function centralizar(page, locator) {
  const caixa = await locator.boundingBox()
  const quadro = await page.locator('.cc-board').boundingBox()
  const de = { x: quadro.x + 24, y: quadro.y + 24 }
  const dx = quadro.x + quadro.width / 2 - (caixa.x + caixa.width / 2)
  const dy = quadro.y + quadro.height / 2 - (caixa.y + caixa.height / 2)
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(de.x + dx / 2, de.y + dy / 2, { steps: 6 })
  await page.mouse.move(de.x + dx, de.y + dy, { steps: 6 })
  await page.mouse.up()
  await esperarAssentar(page, 600)
}

const centralizarNoPrimeiroProjeto = (page) =>
  centralizar(page, page.locator('.cc-project').first())

/** Um recorte de cada tipo de card (livre, PO, planejador, executor, cabecalho) no zoom de agora. */
async function fotosPorTipo(page, fatos, prefixo, saida) {
  const alvos = [
    ['livre', fatos.cards.find((c) => c.papel === 'free')],
    ['po', fatos.cards.find((c) => c.papel === 'po')],
    ['planejador', fatos.cards.find((c) => c.papel === 'planejador')],
    ['executor', fatos.cards.find((c) => c.papel === 'executor')],
    ['cabecalho', fatos.cards.find((c) => c.tipo === 'projeto')]
  ]
  for (const [tipo, card] of alvos) {
    if (!card) {
      continue
    }
    const locator =
      card.tipo === 'projeto'
        ? page.locator('.cc-project').nth(Number(card.chave.split(':')[1]))
        : page.locator(`[data-chat-key="${card.chave}"]`)
    await centralizar(page, locator)
    const caixa = await locator.boundingBox()
    const folga = 70
    const quadro = await page.locator('.cc-board').boundingBox()
    const x = Math.max(quadro.x, caixa.x - folga)
    const y = Math.max(quadro.y, caixa.y - folga)
    await page.screenshot({
      path: path.join(saida, `${prefixo}-${tipo}.png`),
      clip: {
        x,
        y,
        width: Math.min(quadro.x + quadro.width, caixa.x + caixa.width + folga) - x,
        height: Math.min(quadro.y + quadro.height, caixa.y + caixa.height + folga) - y
      }
    })
  }
}

function imprimirAchados(passada, resultado) {
  dizer(`--- ${passada}: ${resultado.achados.length} achados ---`)
  for (const achado of resultado.achados) {
    dizer(
      `ACHADO ${achado.tipo} | ${achado.regra} | ${achado.card} | ${achado.coordenada} | ${achado.detalhe}`
    )
  }
}

const passadas = []
let sobras = []
let janelas = []
let erro = null
let moduloDoCenario = null
try {
  if (tem('--sem-montar') || tem('--app')) {
    dizer('montagem pulada: usando o app ja montado')
  } else {
    dizer('montando a branch atual (cerca de 3 minutos)...')
    montarBranch(saida)
    dizer('montagem pronta')
  }
  dizer(`mundo de teste montado em ${montarMundo()}`)
  const raizDoApp = valor('--app') ? path.resolve(valor('--app')) : RAIZ
  const orca = await abrirOrcaDeTeste({ registro: dizer, manter: tem('--manter'), raizDoApp })
  try {
    const { page } = orca
    const trocouPosicoes = await pedirPagina(page, 'orca-fork.canvas-offsets', valor('--posicoes'))
    const trocouCordas = await pedirPagina(page, 'orca-fork.canvas-cords', valor('--cordas'))
    if (trocouPosicoes || trocouCordas) {
      await page.reload({ timeout: 180_000, waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => window.__store?.getState().repos.length > 0, null, {
        timeout: 120_000
      })
      dizer(
        `cenario de prova: posicoes=${valor('--posicoes') ?? 'reais'} cordas=${valor('--cordas') ?? 'reais'}`
      )
    }
    const [largura, altura] = (valor('--janela') ?? '1500x950').split('x').map(Number)
    await abrirFluxograma(page, { largura, altura })
    const medir = async (nome, arquivo, depoisDoReorganizar) => {
      // O mouse fica fora do fluxograma: um card sob o mouse abre o espiar (card largo) e muda o desenho.
      await page.mouse.move(2, 2)
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(saida, `${arquivo}.png`) })
      const fatos = await lerTela(page)
      writeFileSync(path.join(saida, `${arquivo}-fatos.json`), JSON.stringify(fatos, null, 2))
      const resultado = analisar(fatos, { depoisDoReorganizar })
      dizer(
        `${nome}: ${fatos.projetos.length} projetos, ${fatos.cards.length} cards, ${fatos.linhas.length} linhas e setas, zoom ${fatos.escala.toFixed(2)}; print ${arquivo}.png`
      )
      passadas.push({ nome, fatos, ...resultado })
      imprimirAchados(nome, resultado)
      return fatos
    }

    let modulo = null
    if (valor('--cenario')) {
      modulo = moduloDoCenario = await import(pathToFileURL(path.resolve(valor('--cenario'))).href)
      const recarregar = async () => {
        await page.reload({ timeout: 180_000, waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.__store?.getState().repos.length > 0, null, {
          timeout: 120_000
        })
        await abrirFluxograma(page, { largura, altura })
      }
      await modulo.default(page, {
        lerTela: () => lerTela(page),
        medir,
        saida,
        recarregar,
        mundo: MUNDO_PADRAO,
        dizer
      })
      await esperarAssentar(page, 1500)
      dizer(`cenario de prova montado por ${valor('--cenario')}`)
    }

    await medir('como esta', 'como-esta', false)
    await page.locator('.cc-tidy').click()
    await esperarAssentar(page)
    await modulo?.depoisDoReorganizar?.(page, { lerTela: () => lerTela(page), dizer })
    await esperarAssentar(page, 800)
    const depois = await medir('depois do Reorganizar', 'reorganizado', true)
    dizer(
      `numeros do Reorganizar: card do PO ${JSON.stringify(depois.numeros.larguraDoPoEmPx)} px de largura; margens vazias ${JSON.stringify(depois.numeros.margensEmPx)} px; maior buraco entre projetos ${depois.numeros.maiorBuracoEntreProjetosEmPx} px`
    )
    for (const zoom of (valor('--zoom') ?? '').split(',').filter(Boolean)) {
      await ajustarZoom(page, Number(zoom))
      const fatosDoZoom = await medir(`zoom ${zoom}`, `zoom-${zoom.replace('.', '_')}`, true)
      await fotosPorTipo(page, fatosDoZoom, `tipo-zoom-${zoom.replace('.', '_')}`, saida)
    }
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

try {
  moduloDoCenario?.limpar?.()
} catch {
  // O que o cenario deixou fora do mundo de teste fica para a proxima rodada apagar.
}
// O sistema leva alguns segundos para terminar de fechar o que foi morto: so conta o que ainda vive depois disso.
await new Promise((pronto) => setTimeout(pronto, 4000))
sobras = processosDoMundo()
dizer(`depois de fechar: ${sobras.length} processos do teste ainda vivos`)
for (const sobra of sobras) {
  dizer(`SOBROU: ${sobra.pid} ${sobra.comando}`)
}
const todos = passadas.flatMap((p) => p.achados.map((a) => ({ passada: p.nome, ...a })))
writeFileSync(path.join(saida, 'achados.json'), JSON.stringify(todos, null, 2))
if (todos.length > 0) {
  const porTipo = Object.entries(NOME_DO_TIPO)
    .map(([tipo, nome]) => [nome, todos.filter((a) => a.tipo === tipo).length])
    .filter(([, quantos]) => quantos > 0)
  dizer('RESUMO POR TIPO:')
  for (const [nome, quantos] of porTipo) {
    dizer(`  ${nome}: ${quantos}`)
  }
}
if (erro) {
  dizer(`ERRO: ${erro.message}`)
}
for (const janela of janelas) {
  dizer(`JANELA VISIVEL: ${janela}`)
}
const reprovou = todos.length > 0 || sobras.length > 0 || janelas.length > 0
dizer(
  erro
    ? 'RESULTADO: a vistoria nao terminou (erro acima)'
    : todos.length > 0
      ? `RESULTADO: ${todos.length} achados (acima)`
      : reprovou
        ? 'RESULTADO: zero achado de desenho, mas sobrou processo ou janela do teste (acima)'
        : 'RESULTADO: zero achado'
)
writeFileSync(path.join(saida, 'relato.txt'), relato.join('\n'))
process.exit(erro ? 2 : reprovou ? 1 : 0)
