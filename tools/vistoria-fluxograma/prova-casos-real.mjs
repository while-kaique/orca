// Prova no programa de verdade dos 3 casos dos prints a mao (o-036): monta no Orca de teste escondido a forma de chats de cada
// caso (abas + .hierarquia/estado.json) e, no quadro de 2151 x 1370 px, tira o print e mede o card do PO.
//   --rotulo antigo  : depois do clique no Reorganizar do build antigo (6e43f71910), e depois arrumado a mao como o Kaique (--mao)
//   --rotulo novo    : depois do clique no Reorganizar do build novo
// Uso: node tools/vistoria-fluxograma/prova-casos-real.mjs --caso caso-4-projetos --rotulo novo --raiz PASTA_DO_BUILD --saida PASTA [--mao]
// O estado vem da copia do Orca em uso (preparar-estado.py); nada sai do mundo de teste. Os selos (artefatos, servidores) nao
// existem no mundo de teste: so a forma de chats e reproduzida.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { CASOS } from './casos-encaixe.mjs'
import { lerTela } from './vistoria-leitura-da-tela.mjs'
import { analisar } from './vistoria-regras.mjs'
import {
  abrirFluxograma,
  abrirOrcaDeTeste,
  montarMundo,
  MUNDO_PADRAO,
  RAIZ
} from './orca-de-teste.mjs'

const argumentos = process.argv.slice(2)
const valor = (nome, padrao) => {
  const i = argumentos.indexOf(nome)
  return i === -1 ? padrao : argumentos[i + 1]
}
const rotulo = valor('--rotulo', 'novo')
const caso = CASOS.find((c) => c.id === valor('--caso'))
if (!caso) {
  throw new Error(`--caso precisa ser um de: ${CASOS.map((c) => c.id).join(', ')}`)
}
const saida = path.resolve(valor('--saida', `prova-${caso.id}-${rotulo}`))
const raiz = path.resolve(valor('--raiz', RAIZ))
const comMao = argumentos.includes('--mao')
mkdirSync(saida, { recursive: true })
const QUADRO = { w: 2151, h: 1370 }
const log = []
const dizer = (texto) => {
  log.push(texto)
  console.log(texto)
}

const NOME_DO_REPO = {
  astra: 'astra designer',
  orca: 'orca',
  so: 'sistemas operacionais',
  social: 'social-hub',
  projetos: 'projetos'
}
const repoDoProjeto = (repos, id) =>
  repos.find((r) => r.nome.toLowerCase() === NOME_DO_REPO[id]) ??
  repos.find((r) => r.nome.toLowerCase().includes(NOME_DO_REPO[id]))
const MUNDO = `${MUNDO_PADRAO}-o036c-${rotulo}-${caso.id}`
montarMundo(MUNDO)
const orca = await abrirOrcaDeTeste({ registro: dizer, raiz, mundo: MUNDO })
const { page } = orca
const resultado = { caso: caso.id, rotulo, quadro: QUADRO, etapas: {} }

const lerQuadro = () =>
  page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    const quadro = rect(document.querySelector('.cc-board'))
    const mundo = document.querySelector('.cc-world')
    const escala = Number(/scale\(([-\d.e]+)\)/u.exec(mundo.style.transform)?.[1] ?? 1)
    const projetos = [...document.querySelectorAll('.cc-board .cc-world > div')]
      .filter((bloco) => bloco.querySelector('.cc-project'))
      .map((bloco) => ({
        nome: bloco.querySelector('.cc-project-name')?.textContent?.trim() ?? null,
        caixa: rect(bloco.querySelector('.cc-project')),
        cards: [...bloco.querySelectorAll('[data-chat-key]')].map((el) => ({
          chave: el.dataset.chatKey,
          papel: el.querySelector('.cc-role')?.dataset.role ?? 'free',
          caixa: rect(el)
        })),
        selos: [...bloco.querySelectorAll('.cc-chips')].map(rect)
      }))
    return { quadro, escala, projetos }
  })
const foto = async (nome) => {
  const caixa = await page.evaluate(() => {
    const r = document.querySelector('.cc-board').getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  await page.screenshot({ path: path.join(saida, `${nome}.png`), clip: caixa })
}
/** O que as medidas do criterio 1, 4 e 5 pedem, lidas da tela. */
const medidas = (fatos) => {
  const po = fatos.projetos.flatMap((p) => p.cards).find((c) => c.papel === 'po')
  const caixas = fatos.projetos.flatMap((p) => [
    p.caixa,
    ...p.cards.map((c) => c.caixa),
    ...p.selos
  ])
  const x0 = Math.min(...caixas.map((c) => c.x))
  const y0 = Math.min(...caixas.map((c) => c.y))
  const x1 = Math.max(...caixas.map((c) => c.x + c.w))
  const y1 = Math.max(...caixas.map((c) => c.y + c.h))
  const q = fatos.quadro
  const cards = fatos.projetos.flatMap((p) => p.cards)
  const mundoX = (c) => (c.caixa.x + c.caixa.w / 2 - q.x) / fatos.escala
  const origem = mundoX(cards[0])
  const cabecalhos = fatos.projetos.map((p) => ({
    nome: p.nome,
    y: Math.round(((p.caixa.y - q.y) / fatos.escala) * 10) / 10,
    xCentro: Math.round(((p.caixa.x + p.caixa.w / 2 - q.x) / fatos.escala) * 10) / 10
  }))
  const pos = fatos.projetos.flatMap((p) =>
    p.cards
      .filter((c) => c.papel === 'po')
      .map((c) => ({
        nome: p.nome,
        xCentroPo: Math.round(((c.caixa.x + c.caixa.w / 2 - q.x) / fatos.escala) * 10) / 10
      }))
  )
  return {
    poLarguraPx: Math.round(po.caixa.w * 10) / 10,
    escala: Math.round(fatos.escala * 1000) / 1000,
    margensPx: {
      esquerda: Math.round(x0 - q.x),
      direita: Math.round(q.x + q.w - x1),
      topo: Math.round(y0 - q.y),
      base: Math.round(q.y + q.h - y1)
    },
    desvioMaxDaGrade196: Math.max(
      ...cards.map((c) => {
        const r = (((mundoX(c) - origem) % 196) + 196) % 196
        return Math.min(r, 196 - r)
      })
    ),
    cabecalhos,
    centrosDosPos: pos,
    cardsPorProjeto: Object.fromEntries(
      fatos.projetos.map((p) => [
        p.nome,
        {
          livre: p.cards.filter((c) => c.papel === 'free').length,
          po: p.cards.filter((c) => c.papel === 'po').length,
          planejador: p.cards.filter((c) => c.papel === 'planejador').length,
          executor: p.cards.filter((c) => c.papel === 'executor').length
        }
      ])
    )
  }
}
const registrar = async (nome) => {
  const fatos = await lerQuadro()
  // A vistoria le a mesma tela: vao entre projetos vizinhos (em unidades e px) e o que ela reprova.
  const tela = await lerTela(page)
  const { achados, vaos } = analisar(tela, { depoisDoReorganizar: true })
  const emPx = (d) => Math.round(d * tela.escala * 10) / 10
  const vaosPx = Object.fromEntries(vaos.map((v) => [v.projeto, emPx(v.distancia)]))
  resultado.etapas[nome] = { ...medidas(fatos), fatos, vaosPx, achados }
  await foto(nome)
  dizer(
    `${nome}: card do PO ${resultado.etapas[nome].poLarguraPx} px; margens ${JSON.stringify(resultado.etapas[nome].margensPx)}; vao ao vizinho em px ${JSON.stringify(vaosPx)}; achados da vistoria ${achados.length} ${JSON.stringify([...new Set(achados.map((a) => a.tipo))])}`
  )
}

try {
  // 1. O mundo do caso: tira todas as abas e cria so as do caso, com o papel de cada uma no estado.json do projeto.
  const repos = await page.evaluate(() => {
    const estado = window.__store.getState()
    return estado.repos.map((repo) => ({
      id: repo.id,
      nome: repo.displayName,
      caminho: repo.path.replaceAll('\\', '/'),
      pastas: (estado.worktreesByRepo[repo.id] ?? []).map((w) => ({
        id: w.id,
        caminho: w.path.replaceAll('\\', '/')
      }))
    }))
  })
  resultado.repos = repos.map((r) => r.nome)
  await page.waitForFunction(
    () => Object.values(window.__store.getState().tabsByWorktree).some((abas) => abas.length > 0),
    null,
    { timeout: 60_000 }
  )
  await page.evaluate(() => {
    const estado = window.__store.getState()
    for (const abas of Object.values(estado.tabsByWorktree)) {
      for (const aba of abas.slice()) {
        estado.closeTab(aba.id)
      }
    }
  })
  await page.waitForTimeout(1500)
  for (const projeto of caso.projetos) {
    const repo = repoDoProjeto(repos, projeto.id)
    if (!repo) {
      throw new Error(
        `o mundo de teste nao tem o projeto ${projeto.id} (${repos.map((r) => r.nome)})`
      )
    }
    const pasta = repo.pastas.find((p) => p.caminho === repo.caminho) ?? repo.pastas[0]
    const chaves = {}
    for (const [chave] of projeto.chats) {
      chaves[chave] = await page.evaluate(
        (id) => window.__store.getState().createTab(id).id,
        pasta.id
      )
    }
    const arquivo = path.join(repo.caminho, '.hierarquia', 'estado.json')
    // Um projeto so com chats livres pode nao ter estado de hierarquia: nao ha o que escrever nele.
    if (!existsSync(arquivo) && projeto.chats.every(([, tipo]) => tipo === 'livre')) {
      dizer(`${repo.nome}: ${projeto.chats.length} chats criados (sem hierarquia)`)
      continue
    }
    const doc = JSON.parse(readFileSync(arquivo, 'utf8'))
    doc.chats = {}
    for (const [chave, tipo, pai] of projeto.chats) {
      if (tipo !== 'livre') {
        doc.chats[chaves[chave]] = {
          id: chaves[chave],
          handle: `term_${chaves[chave]}`,
          papel: tipo,
          modelo: 'sonnet',
          pai: pai ? chaves[pai] : null,
          ordemId: null,
          ativo: true,
          mexidoPeloKaique: false
        }
      }
    }
    writeFileSync(arquivo, JSON.stringify(doc, null, 2))
    dizer(`${repo.nome}: ${projeto.chats.length} chats criados`)
  }

  // 2. O quadro de 2151 x 1370 px.
  await abrirFluxograma(page, { largura: 2600, altura: 1500, espera: 8000 })
  let largura = 2600
  let altura = 1500
  for (let i = 0; i < 4; i++) {
    const quadro = await page.evaluate(() => {
      const r = document.querySelector('.cc-board').getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })
    if (quadro.w === QUADRO.w && quadro.h === QUADRO.h) {
      break
    }
    largura += QUADRO.w - quadro.w
    altura += QUADRO.h - quadro.h
    await page.setViewportSize({ width: largura, height: altura })
    await page.waitForTimeout(1500)
  }
  await page.waitForTimeout(2000)
  await registrar('1-abriu')

  // 3. O clique no Reorganizar.
  await page.click('.cc-tidy')
  await page.waitForTimeout(2500)
  await registrar(`2-reorganizado-${rotulo}`)

  // 4. A arrumacao a mao do Kaique, com o mouse: cada projeto vai para onde ele o pos no print, e o zoom justo no fim.
  if (comMao) {
    const primeiro = caso.projetos[0].id
    const fatos = await lerQuadro()
    const nomes = Object.fromEntries(
      caso.projetos.map((p) => [
        p.id,
        fatos.projetos.find((q) => q.nome?.toLowerCase().includes(NOME_DO_REPO[p.id]))
      ])
    )
    const base = nomes[primeiro].caixa
    for (const projeto of caso.projetos.slice(1)) {
      const atual = (await lerQuadro()).projetos.find((q) =>
        q.nome?.toLowerCase().includes(NOME_DO_REPO[projeto.id])
      ).caixa
      const escala = (await lerQuadro()).escala
      const alvoX = base.x + caso.mao[projeto.id][0] * escala
      const alvoY = base.y + caso.mao[projeto.id][1] * escala
      const de = { x: atual.x + atual.w / 2, y: atual.y + 20 }
      await page.mouse.move(de.x, de.y)
      await page.mouse.down()
      await page.mouse.move(de.x + (alvoX - atual.x) / 2, de.y + (alvoY - atual.y) / 2, {
        steps: 8
      })
      await page.mouse.move(de.x + (alvoX - atual.x), de.y + (alvoY - atual.y), { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(500)
    }
    // Zoom justo: o desenho todo cabe com um leve espaco, como ele deixou (roda do mouse no centro do quadro).
    for (let volta = 0; volta < 6; volta++) {
      const f = await lerQuadro()
      const caixas = f.projetos.flatMap((p) => [
        p.caixa,
        ...p.cards.map((c) => c.caixa),
        ...p.selos
      ])
      const x0 = Math.min(...caixas.map((c) => c.x))
      const y0 = Math.min(...caixas.map((c) => c.y))
      const x1 = Math.max(...caixas.map((c) => c.x + c.w))
      const y1 = Math.max(...caixas.map((c) => c.y + c.h))
      const livreL = f.quadro.w - 2 * 32
      const livreA = f.quadro.h - 64 - 2 * 32
      const razao = Math.min(livreL / (x1 - x0), livreA / (y1 - y0), 1 / f.escala)
      if (
        Math.abs(razao - 1) < 0.005 &&
        Math.abs((x0 + x1) / 2 - (f.quadro.x + f.quadro.w / 2)) < 3
      ) {
        break
      }
      const centroX = f.quadro.x + f.quadro.w / 2
      const centroY = f.quadro.y + 32 + livreA / 2
      await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2)
      await page.mouse.wheel(0, -Math.log(razao) / 0.0015)
      await page.waitForTimeout(400)
      const g = await lerQuadro()
      const gx0 = Math.min(
        ...g.projetos.flatMap((p) => [p.caixa, ...p.cards.map((c) => c.caixa)]).map((c) => c.x)
      )
      const gx1 = Math.max(
        ...g.projetos
          .flatMap((p) => [p.caixa, ...p.cards.map((c) => c.caixa)])
          .map((c) => c.x + c.w)
      )
      const gy0 = Math.min(
        ...g.projetos.flatMap((p) => [p.caixa, ...p.cards.map((c) => c.caixa)]).map((c) => c.y)
      )
      const gy1 = Math.max(
        ...g.projetos
          .flatMap((p) => [p.caixa, ...p.cards.map((c) => c.caixa)])
          .map((c) => c.y + c.h)
      )
      const dx = centroX - (gx0 + gx1) / 2
      const dy = centroY - (gy0 + gy1) / 2
      await page.mouse.move(g.quadro.x + 40, g.quadro.y + 40)
      await page.mouse.down()
      await page.mouse.move(g.quadro.x + 40 + dx, g.quadro.y + 40 + dy, { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(500)
    }
    await registrar('3-a-mao')
  }
} finally {
  writeFileSync(path.join(saida, 'fatos.json'), JSON.stringify(resultado, null, 2))
  const sobras = await orca.fechar()
  dizer(`encerrado; processos que sobraram: ${sobras.length}`)
  writeFileSync(path.join(saida, 'rodada.txt'), log.join('\n'))
}
