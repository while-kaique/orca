// Prova no programa de verdade do lugar dos cards (o-036): abre o Orca de teste escondido com copia do estado real,
// tira os numeros e os prints antes e depois do Reorganizar, e (versao nova) mostra chat nascendo e projeto arrastado.
// Uso: node tools/vistoria-fluxograma/prova-encaixe-real.mjs --rotulo antigo|novo --saida PASTA [--raiz PASTA_DO_CODIGO] [--nascer]
// O quadro do fluxograma fica em 2151 x 1370 px (o do print do Kaique). Nada sai do mundo de teste.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
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
const saida = path.resolve(valor('--saida', `prova-${rotulo}`))
const raiz = path.resolve(valor('--raiz', RAIZ))
const nascer = argumentos.includes('--nascer')
const arrastes = argumentos.includes('--arrastes')
mkdirSync(saida, { recursive: true })
const [quadroLargura, quadroAltura] = valor('--quadro', '2151x1370').split('x').map(Number)
const QUADRO = { w: quadroLargura, h: quadroAltura }
const log = []
const dizer = (texto) => {
  log.push(texto)
  console.log(texto)
}

// Mundo proprio: outras vistorias usam o padrao ao mesmo tempo e nao podem se atropelar.
const MUNDO = `${MUNDO_PADRAO}-o036-${rotulo}`
const mundo = montarMundo(MUNDO)
const orca = await abrirOrcaDeTeste({ registro: dizer, raiz, mundo: MUNDO })
const { page } = orca
const resultado = { rotulo, quadro: QUADRO, etapas: {} }
try {
  if (arrastes) {
    // Os arrastes entram antes de o fluxograma abrir pela primeira vez: e como o estado guardado de uma versao antiga chega.
    // Arrastes guardados como o Orca em uso os guardaria: um projeto inteiro e dois chats soltos.
    await page.waitForFunction(
      () => Object.values(window.__store.getState().tabsByWorktree).some((abas) => abas.length > 0),
      null,
      { timeout: 60_000 }
    )
    const semente = valor('--semente')
    const guardados = semente
      ? JSON.parse(readFileSync(semente, 'utf8')).arrastesGuardados
      : await page.evaluate(() => {
          const estado = window.__store.getState()
          const porProjeto = estado.repos.map((repo) => ({
            id: repo.id,
            abas: (estado.worktreesByRepo[repo.id] ?? []).flatMap((w) =>
              (estado.tabsByWorktree[w.id] ?? []).map((t) => t.id)
            )
          }))
          const posicoes = {}
          const primeiro = porProjeto.find((p) => p.abas.length > 0)
          if (primeiro) {
            posicoes[`project:${primeiro.id}`] = { dx: -150, dy: 90 }
            for (const aba of primeiro.abas) {
              posicoes[aba] = { dx: -150, dy: 90 }
            }
          }
          for (const p of porProjeto
            .filter((q) => q !== primeiro && q.abas.length > 1)
            .slice(0, 2)) {
            posicoes[p.abas[1]] = { dx: 210, dy: -130 }
          }
          window.localStorage.setItem('orca-fork.canvas-offsets', JSON.stringify(posicoes))
          return posicoes
        })
    if (semente) {
      await page.evaluate(
        (posicoes) =>
          window.localStorage.setItem('orca-fork.canvas-offsets', JSON.stringify(posicoes)),
        guardados
      )
    }
    // O Orca de teste pode ter aberto o fluxograma sozinho (a vista ativa vem do estado copiado) e guardado ancoras
    // antes dos arrastes: apaga, para a abertura seguinte ser a primeira com arrastes e sem ancoras.
    await page.evaluate(() => window.localStorage.removeItem('orca-fork.canvas-anchors'))
    resultado.arrastesGuardados = guardados
    await page.reload()
    await page.waitForFunction(() => window.__store?.getState().repos.length > 0, null, {
      timeout: 120_000
    })
  }

  await abrirFluxograma(page, { largura: 2600, altura: 1500, espera: 3000 })
  // Ajusta a janela ate o quadro do fluxograma medir 2151 x 1370.
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

  const ler = () =>
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
            titulo: el.querySelector('.cc-chat-head')?.textContent?.trim().slice(0, 40) ?? null,
            caixa: rect(el)
          })),
          selos: [...bloco.querySelectorAll('.cc-chips')].map(rect)
        }))
      return {
        quadro,
        escala,
        projetos,
        ancoras: window.localStorage.getItem('orca-fork.canvas-anchors'),
        posicoes: window.localStorage.getItem('orca-fork.canvas-offsets')
      }
    })
  const foto = async (nome) => {
    const caixa = await page.evaluate(() => {
      const r = document.querySelector('.cc-board').getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    await page.screenshot({ path: path.join(saida, `${nome}.png`), clip: caixa })
  }
  const registrar = async (nome) => {
    const fatos = await ler()
    resultado.etapas[nome] = fatos
    await foto(nome)
    return fatos
  }

  await page.waitForTimeout(2000)
  await registrar('1-inicio')
  // Passa do tempo em que a versao nova guarda as ancoras: nada pode ter se mexido.
  await page.waitForTimeout(12_000)
  await registrar('2-inicio-depois-de-guardar')
  await page.click('.cc-tidy')
  await page.waitForTimeout(2500)
  await registrar('3-reorganizado')

  if (nascer) {
    const dados = await page.evaluate(() => {
      const estado = window.__store.getState()
      return estado.repos.map((repo) => ({
        id: repo.id,
        nome: repo.displayName,
        caminho: repo.path,
        pastas: (estado.worktreesByRepo[repo.id] ?? []).map((w) => ({ id: w.id, caminho: w.path }))
      }))
    })
    resultado.repos = dados.map((d) => d.nome)
    const alvo = dados.find((d) => d.nome === 'social-hub-gogroup') ?? dados[0]
    const pasta =
      alvo.pastas.find(
        (p) => p.caminho.replaceAll('\\', '/') === alvo.caminho.replaceAll('\\', '/')
      ) ?? alvo.pastas[0]
    const estadoJson = path.join(alvo.caminho, '.hierarquia', 'estado.json')
    const lerProjeto = async () => (await ler()).projetos.find((p) => p.nome?.endsWith(alvo.nome))
    const criarAba = () =>
      page.evaluate((id) => window.__store.getState().createTab(id).id, pasta.id)
    const registrarNoEstado = (chave, papel, pai) => {
      const doc = JSON.parse(readFileSync(estadoJson, 'utf8'))
      doc.chats[chave] = {
        id: chave,
        handle: `term_${chave}`,
        papel,
        modelo: 'sonnet',
        pai,
        ordemId: null,
        ativo: true,
        mexidoPeloKaique: false
      }
      writeFileSync(estadoJson, JSON.stringify(doc, null, 2))
    }
    const donoDe = (fatos, pai) =>
      pai ? fatos.cards.find((c) => c.chave === pai)?.caixa : fatos.caixa
    const colunas = (a, b, escala) => {
      const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0)
      const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0)
      return Math.round((Math.max(gapX, gapY) / escala / 392) * 100) / 100
    }
    const posicoesDe = (fatos) =>
      Object.fromEntries(
        fatos.projetos.map((p) => [
          p.nome,
          { x: p.caixa.x / fatos.escala, y: p.caixa.y / fatos.escala }
        ])
      )
    const nascimentos = []
    const nascimento = async (prefixo, tipo, papel, pai) => {
      const antesGeral = await ler()
      const chave = await criarAba()
      if (papel) {
        registrarNoEstado(chave, papel, pai)
      }
      await page.waitForTimeout(papel ? 5000 : 1500)
      const depoisGeral = await registrar(`${prefixo}-nasceu-${tipo}`)
      const projeto = depoisGeral.projetos.find((p) => p.nome?.endsWith(alvo.nome))
      const novo = projeto.cards.find((c) => c.chave === chave)
      const dono = donoDe(projeto, pai)
      const antes = posicoesDe(antesGeral)
      const depois = posicoesDe(depoisGeral)
      nascimentos.push({
        prefixo,
        tipo,
        papelNaTela: novo?.papel ?? null,
        colunasAteODono: novo && dono ? colunas(novo.caixa, dono, depoisGeral.escala) : null,
        movimentoDosProjetos: Object.fromEntries(
          Object.keys(depois).map((nome) => [
            nome,
            {
              dx: Math.round((depois[nome].x - antes[nome].x) * 10) / 10,
              dy: Math.round((depois[nome].y - antes[nome].y) * 10) / 10
            }
          ])
        )
      })
      return chave
    }
    const base = await lerProjeto()
    const po = base.cards.find((c) => c.papel === 'po')?.chave ?? null
    // Estabilidade: logo depois do Reorganizar, um planejador nasce no projeto e nada mais se mexe.
    await registrar('4-estabilidade-antes')
    const novoPlanejador = await nascimento('4-estabilidade', 'planejador', 'planejador', po)
    await page.waitForTimeout(6000)
    await registrar('4-estabilidade-depois')
    // Chat novo colado no dono, num projeto que foi arrastado antes.
    const antes = await lerProjeto()
    await page.mouse.move(antes.caixa.x + 60, antes.caixa.y + 40)
    await page.mouse.down()
    await page.mouse.move(antes.caixa.x + 160, antes.caixa.y + 90, { steps: 8 })
    await page.mouse.move(antes.caixa.x + 260, antes.caixa.y + 140, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(800)
    await registrar('5-projeto-arrastado')
    await nascimento('5', 'livre', null, null)
    await nascimento('5', 'po', 'po', null)
    const planejador = await nascimento('5', 'planejador', 'planejador', po)
    await nascimento('5', 'executor', 'executor', planejador)
    void novoPlanejador
    resultado.nascimentos = nascimentos
  }

  // Meio minuto parado: o calculo do lugar nao pode rodar em laco.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
  await cdp.send('Profiler.start')
  await page.waitForTimeout(30_000)
  const { profile } = await cdp.send('Profiler.stop')
  const nos = new Map(profile.nodes.map((n) => [n.id, n]))
  const porNo = new Map()
  profile.samples.forEach((id, i) =>
    porNo.set(id, (porNo.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0))
  )
  let ocioso = 0
  let total = 0
  for (const [id, us] of porNo) {
    total += us
    if (nos.get(id)?.callFrame.functionName === '(idle)') {
      ocioso += us
    }
  }
  let nasPaginas = 0
  for (const [id, us] of porNo) {
    if (/CanvasChatsPage/u.test(nos.get(id)?.callFrame.url ?? '')) {
      nasPaginas += us
    }
  }
  resultado.perfilParado = {
    tempoNoCodigoDoFluxogramaMs: Math.round(nasPaginas / 1000),
    segundos: Math.round(total / 1e6),
    ocupadoMs: Math.round((total - ocioso) / 1000),
    ociosoPercentual: Math.round((ocioso / total) * 1000) / 10
  }
  dizer(
    `perfil de 30 s parado: ocupado ${resultado.perfilParado.ocupadoMs} ms, ocioso ${resultado.perfilParado.ociosoPercentual}%`
  )
} finally {
  writeFileSync(path.join(saida, 'fatos.json'), JSON.stringify(resultado, null, 2))
  const sobras = await orca.fechar()
  dizer(`encerrado; processos que sobraram: ${sobras.length}`)
  writeFileSync(path.join(saida, 'rodada.txt'), log.join('\n'))
}
void mundo
