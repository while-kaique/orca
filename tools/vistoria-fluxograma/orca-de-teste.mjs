// Abre um Orca de teste escondido (janela oculta, sem foco) sobre um "mundo de teste" e o fecha sem sobra.
// Usado por vistoria.mjs e vistoria-juncao.mjs; as provas avulsas importam as mesmas funcoes.
// Regra B: um Orca de teste por vez na maquina (trava unica), montado uma vez e reusado. Uso: LEIAME.md.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { lerJson, processoVivo } from '../../skills/hierarquia/trava.mjs'
import { montarBranch } from './montagem-do-orca-de-teste.mjs'
import { encerrarMundo } from './processos-de-teste.mjs'
import { modoSimulado, MUNDO_PADRAO, RAIZ, sleep } from './raiz-e-mundo-de-teste.mjs'
import {
  ARQUIVO_DA_TRAVA,
  atualizarTrava,
  descreverEstadoDoOrcaDeTeste,
  donoDestaRodada,
  mensagemDeUso,
  OrcaDeTesteOcupado,
  pegarTravaDoOrcaDeTeste,
  travaViva
} from './trava-do-orca-de-teste.mjs'

// Quem importava tudo daqui continua importando daqui.
export * from './montagem-do-orca-de-teste.mjs'
export * from './processos-de-teste.mjs'
export * from './raiz-e-mundo-de-teste.mjs'
export * from './trava-do-orca-de-teste.mjs'

const require = createRequire(import.meta.url)

/** `manter`: nomes de projetos que entram no mundo mesmo sem chat aberto no estado real (casos de prova). */
export function montarMundo(mundo = MUNDO_PADRAO, manter = []) {
  const dono = lerJson(ARQUIVO_DA_TRAVA)
  if (
    travaViva(dono) &&
    path.resolve(dono.mundo) === path.resolve(mundo) &&
    dono.pidNode !== process.pid
  ) {
    throw new OrcaDeTesteOcupado(`${mensagemDeUso(dono)}: nao refaco o mundo dele (${mundo}).`)
  }
  const saida = execFileSync(
    'python',
    [path.join(RAIZ, 'tools', 'vistoria-fluxograma', 'preparar-estado.py'), mundo],
    { encoding: 'utf8', env: { ...process.env, VISTORIA_MANTER_REPOS: manter.join(',') } }
  )
  return saida.trim()
}

function ambienteDoOrcaDeTeste(mundo) {
  const env = { ...process.env }
  for (const nome of Object.keys(env)) {
    if (/^(ORCA_|CLAUDE|AI_AGENT)/u.test(nome)) {
      delete env[nome]
    }
  }
  delete env.ELECTRON_RUN_AS_NODE
  return Object.assign(env, {
    ORCA_BACKGROUND_LAUNCH: '1',
    ORCA_DEV_USER_DATA_PATH: path.join(mundo, 'perfil'),
    ORCA_DEV_INSTANCE_KEY: 'vistoria-fluxograma',
    // Sem rede da conta: o perfil copiado e ligado a nuvem, o de teste nao fala com ela.
    ORCA_CLOUD_API_URL: 'http://127.0.0.1:9'
  })
}

async function esperarPortaDeInspecao(portaCdp, filho, pastaDoLog) {
  const limite = Date.now() + 120_000
  for (;;) {
    if (filho.exitCode !== null) {
      throw new Error(
        `O Orca de teste saiu antes de abrir (codigo ${filho.exitCode}). Veja ${path.join(pastaDoLog, 'orca-de-teste.log')}`
      )
    }
    try {
      const resposta = await fetch(`http://127.0.0.1:${portaCdp}/json/version`)
      if (resposta.ok) {
        return
      }
    } catch {
      // Ainda subindo.
    }
    if (Date.now() > limite) {
      throw new Error('O Orca de teste nao abriu a porta de inspecao em 2 minutos.')
    }
    await sleep(500)
  }
}

/** Conecta no Orca que ja esta aberto nessa porta e espera o estado do app carregar. */
async function conectarNaPorta(portaCdp) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${portaCdp}`, {
    timeout: 180_000
  })
  let page
  while (!page) {
    page = browser
      .contexts()[0]
      ?.pages()
      .find((p) => !p.url().startsWith('devtools'))
    if (!page) {
      await sleep(300)
    }
  }
  await page.waitForFunction(() => window.__store?.getState().repos.length > 0, null, {
    timeout: 120_000
  })
  return { browser, page }
}

/**
 * Abre o Orca montado em `raiz`/out (padrao RAIZ/out), escondido, com o perfil do mundo. Devolve { page, fechar, porta }.
 * Pega a trava unica da maquina antes (espera ate `esperarMin` min; 0 = recusa na hora, saida 3). `prepararMundo` roda
 * com a trava na mao, antes de abrir (e onde se refaz o mundo sem pisar no de quem usa).
 * `fechar()` desconecta, mata a arvore de processos do mundo, apaga o mundo (a menos que manter) e solta a trava.
 * `deixarAberto`: o Orca fica vivo depois deste processo e a trava fica com a porta (use `desconectar()`).
 * ORCA_DE_TESTE_SIMULADO=1: no lugar do Electron sobe um node que dorme com uma porta HTTP falsa (prova da trava).
 */
export async function abrirOrcaDeTeste({
  mundo = MUNDO_PADRAO,
  porta,
  registro = console.log,
  manter = false,
  raiz = RAIZ,
  esperarMin = 30,
  prepararMundo,
  deixarAberto = false
} = {}) {
  const portaCdp = porta ?? 9560 + Math.floor(Math.random() * 300)
  const simulado = modoSimulado()
  const pastaDoLog = path.join(mundo, 'logs')
  const soltar = await pegarTravaDoOrcaDeTeste({
    esperarMin,
    registro,
    dados: {
      dono: donoDestaRodada(),
      pasta: raiz,
      raiz: RAIZ,
      mundo,
      pidNode: process.pid,
      pidElectron: null,
      porta: portaCdp,
      comando: process.argv.slice(1).join(' ').slice(0, 300),
      desde: new Date().toISOString(),
      simulado
    }
  })
  let filho
  let browser
  let encerrado = false
  const aoSair = () => {
    if (encerrado || deixarAberto) {
      return
    }
    if (filho?.pid) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(filho.pid)], {
        stdio: 'ignore',
        windowsHide: true
      })
    }
    soltar()
  }
  const aoInterromper = () => process.exit(130)
  process.on('exit', aoSair)
  process.on('SIGINT', aoInterromper)
  const limpar = async () => {
    try {
      await browser?.close()
    } catch {
      // A conexao ja caiu.
    }
    const sobras = await encerrarMundo(mundo, filho?.pid ? [filho.pid] : [])
    if (!manter) {
      try {
        rmSync(mundo, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
      } catch {
        // Um arquivo ainda preso pelo sistema: a proxima rodada apaga o mundo antes de montar o dela.
      }
    }
    encerrado = true
    soltar()
    process.off('exit', aoSair)
    process.off('SIGINT', aoInterromper)
    return sobras
  }
  try {
    await prepararMundo?.()
    mkdirSync(pastaDoLog, { recursive: true })
    const log = openSync(path.join(pastaDoLog, 'orca-de-teste.log'), 'a')
    const opcoes = {
      cwd: raiz,
      env: ambienteDoOrcaDeTeste(mundo),
      windowsHide: true,
      detached: deixarAberto,
      stdio: ['ignore', log, log]
    }
    filho = simulado
      ? spawn(
          process.execPath,
          [
            path.join(import.meta.dirname, 'orca-de-teste-simulado.mjs'),
            String(portaCdp),
            path.join(mundo, 'perfil')
          ],
          opcoes
        )
      : spawn(require('electron'), ['.', `--remote-debugging-port=${portaCdp}`], opcoes)
    closeSync(log)
    if (deixarAberto) {
      filho.unref()
    }
    atualizarTrava({ pidElectron: filho.pid })
    await esperarPortaDeInspecao(portaCdp, filho, pastaDoLog)
    let page = null
    if (!simulado) {
      ;({ browser, page } = await conectarNaPorta(portaCdp))
    }
    registro(`Orca de teste${simulado ? ' SIMULADO' : ''} aberto (porta ${portaCdp}, ${filho.pid})`)
    return {
      page,
      porta: portaCdp,
      pid: filho.pid,
      reusado: false,
      fechar: limpar,
      // Deixa o Orca vivo com a trava: so este processo se solta dele.
      // Why no browser.close(): over the inspection port it shuts the Orca itself; leaving the process drops the link.
      desconectar: async () => {
        encerrado = true
        process.off('exit', aoSair)
        process.off('SIGINT', aoInterromper)
      }
    }
  } catch (erro) {
    await limpar()
    throw erro
  }
}

/**
 * Conecta no Orca de teste que ja esta aberto (pela porta da trava) em vez de abrir outro. So conecta se o dono for
 * esta mesma pasta RAIZ ou se `reusar` vier ligado. Devolve null se nao ha Orca aberto; recusa (saida 3) se e de outro.
 * `fechar()` so desconecta: o Orca continua aberto para a proxima rodada.
 */
export async function conectarOrcaDeTeste({ reusar = false, registro = console.log } = {}) {
  const trava = lerJson(ARQUIVO_DA_TRAVA)
  if (!travaViva(trava) || !trava.porta || !trava.pidElectron || !processoVivo(trava.pidElectron)) {
    return null
  }
  if (!reusar && path.resolve(trava.raiz).toLowerCase() !== path.resolve(RAIZ).toLowerCase()) {
    throw new OrcaDeTesteOcupado(
      `${mensagemDeUso(trava)}; nao e desta pasta: passe reusar para usar o mesmo Orca de teste.`
    )
  }
  const resposta = await fetch(`http://127.0.0.1:${trava.porta}/json/version`)
  if (!resposta.ok) {
    throw new Error(`O Orca de teste da trava nao responde na porta ${trava.porta}.`)
  }
  let page = null
  if (!trava.simulado) {
    ;({ page } = await conectarNaPorta(trava.porta))
  }
  registro(
    `Conectado no Orca de teste ja aberto (porta ${trava.porta}, PID ${trava.pidElectron}, dono ${trava.dono}); ele continua aberto no fim.`
  )
  return {
    page,
    porta: trava.porta,
    pid: trava.pidElectron,
    reusado: true,
    // Only lets go: browser.close() over the inspection port would shut the Orca this run reused.
    fechar: async () => []
  }
}

/** Fecha o Orca de teste da trava: o seu (mesma pasta RAIZ), ou com `forcar` o de dono morto. Nunca o de outro vivo. */
export async function fecharOrcaDeTeste({
  forcar = false,
  manter = false,
  registro = console.log
} = {}) {
  const trava = lerJson(ARQUIVO_DA_TRAVA)
  if (!trava) {
    registro('Nao ha trava: nenhum Orca de teste aberto por esta ferramenta.')
    return []
  }
  const viva = travaViva(trava)
  const meu = path.resolve(trava.raiz).toLowerCase() === path.resolve(RAIZ).toLowerCase()
  if (viva && !meu) {
    throw new OrcaDeTesteOcupado(`${mensagemDeUso(trava)}; e de outra pasta, nao fecho o de outro.`)
  }
  if (!viva && !forcar) {
    throw new OrcaDeTesteOcupado(
      `Trava de dono morto (${trava.dono}, PID ${trava.pidNode}); rode fechar --forcar para encerrar o que cita o mundo dela e soltar.`
    )
  }
  const sobras = await encerrarMundo(
    trava.mundo,
    viva && trava.pidElectron ? [trava.pidElectron] : []
  )
  if (!manter) {
    rmSync(trava.mundo, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  }
  rmSync(ARQUIVO_DA_TRAVA, { force: true })
  registro(
    `Orca de teste de ${trava.dono} fechado; sobraram ${sobras.length} processos do mundo dele.`
  )
  return sobras
}

/** Abre o fluxograma na janela escondida e espera o desenho assentar (a hierarquia chega a cada 3 s). */
export async function abrirFluxograma(page, { largura = 1500, altura = 950, espera = 5000 } = {}) {
  await page.setViewportSize({ width: largura, height: altura })
  await page.evaluate(() => window.__store.getState().openCanvasPage())
  await page.waitForSelector('.cc-board [data-chat-key]', { timeout: 60_000 })
  await page.waitForTimeout(espera)
}

/** O que o desenho mostra: cada projeto com os cards dele, o papel e o lugar de cada um na tela. */
export async function lerFluxograma(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height)
      }
    }
    const projetos = [...document.querySelectorAll('.cc-board .cc-world > div')]
      .filter((bloco) => bloco.querySelector('.cc-project'))
      .map((bloco) => {
        const projeto = bloco.querySelector('.cc-project')
        const caixa = rect(projeto)
        const cards = [...bloco.querySelectorAll('[data-chat-key]')].map((el) => {
          const c = rect(el)
          const papel =
            el.querySelector('.cc-role')?.dataset.role ?? (el.dataset.launch ? 'abrindo-po' : null)
          return {
            chave: el.dataset.chatKey,
            papel,
            mascara: el.dataset.launch ?? 'off',
            titulo: el.querySelector('.cc-chat-head')?.textContent?.trim().slice(0, 50) ?? null,
            caixa: c,
            lado:
              c.y + c.h <= caixa.y ? 'em-cima' : c.y >= caixa.y + caixa.h ? 'embaixo' : 'ao-lado'
          }
        })
        return {
          nome: projeto.querySelector('.cc-project-name')?.textContent?.trim() ?? null,
          caixa,
          cards
        }
      })
    return {
      projetos,
      posicoesGuardadas: window.localStorage.getItem('orca-fork.canvas-offsets')
    }
  })
}

/** O lado certo de cada card: hierarquia (e PO abrindo) embaixo do projeto, livre em cima. Devolve os que estao errados. */
export function cardsNoLugarErrado(fatos) {
  const errados = []
  for (const projeto of fatos.projetos) {
    for (const card of projeto.cards) {
      const deveriaEstarEmbaixo = card.papel !== 'free'
      if (deveriaEstarEmbaixo && card.lado !== 'embaixo') {
        errados.push(
          `${projeto.nome}: ${card.papel} "${card.titulo}" esta ${card.lado}, deveria estar embaixo`
        )
      }
      if (!deveriaEstarEmbaixo && card.lado !== 'em-cima') {
        errados.push(
          `${projeto.nome}: livre "${card.titulo}" esta ${card.lado}, deveria estar em cima`
        )
      }
    }
  }
  return errados
}

export const lerArquivo = (arquivo) => readFileSync(arquivo, 'utf8')

/** Linha de comando: abrir | estado | fechar | montar (ver LEIAME.md). */
async function linhaDeComando(argumentos) {
  const [comando, ...resto] = argumentos
  const tem = (nome) => resto.includes(nome)
  const valor = (nome) => resto[resto.indexOf(nome) + 1]
  const hora = () => new Date().toLocaleTimeString('pt-BR')
  const dizer = (texto) => console.log(`[${hora()}] ${texto}`)
  const pastaDoLog = path.join(RAIZ, '.cache', 'vistoria-fluxograma', 'orca-de-teste')
  if (comando === 'estado') {
    console.log(descreverEstadoDoOrcaDeTeste())
  } else if (comando === 'montar') {
    mkdirSync(pastaDoLog, { recursive: true })
    montarBranch(pastaDoLog, dizer)
  } else if (comando === 'fechar') {
    await fecharOrcaDeTeste({ forcar: tem('--forcar'), manter: tem('--manter'), registro: dizer })
  } else if (comando === 'abrir') {
    const simulado = modoSimulado()
    if (!simulado) {
      mkdirSync(pastaDoLog, { recursive: true })
      montarBranch(pastaDoLog, dizer)
    }
    // The dev Orca quits when the process that launched it goes away, so this command holds it open until
    // "fechar" (or Ctrl+C here): run it in the background; other runs reuse it with --reusar.
    const orca = await abrirOrcaDeTeste({
      registro: dizer,
      esperarMin: tem('--esperar-min') ? Number(valor('--esperar-min')) : undefined,
      prepararMundo: () =>
        simulado
          ? mkdirSync(MUNDO_PADRAO, { recursive: true })
          : dizer(`mundo de teste montado em ${montarMundo()}`)
    })
    dizer(
      `Orca de teste aberto e seguro por este comando (porta ${orca.porta}, PID ${orca.pid}, node ${process.pid}). Use --reusar nas vistorias; para fechar: node tools/vistoria-fluxograma/orca-de-teste.mjs fechar`
    )
    const sair = () => orca.fechar().finally(() => process.exit(0))
    process.on('SIGTERM', sair)
    process.on('SIGBREAK', sair)
    await new Promise((resolve) => {
      const vigia = setInterval(() => {
        if (!processoVivo(orca.pid)) {
          clearInterval(vigia)
          resolve()
        }
      }, 2000)
    })
    await orca.fechar()
    dizer('Orca de teste fechado; este comando sai.')
  } else {
    console.log(
      'node tools/vistoria-fluxograma/orca-de-teste.mjs <abrir [--esperar-min N] | estado | fechar [--forcar] [--manter] | montar>'
    )
    process.exit(comando ? 2 : 0)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await linhaDeComando(process.argv.slice(2))
    process.exit(0)
  } catch (erro) {
    console.error(erro.message)
    process.exit(erro.codigoDeSaida ?? 2)
  }
}
