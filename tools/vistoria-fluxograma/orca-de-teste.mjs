// Abre um Orca de teste escondido (janela oculta, sem foco) sobre um "mundo de teste" e o fecha sem sobra.
// Usado por vistoria-juncao.mjs; as provas avulsas importam as mesmas funcoes.
import { execFileSync, spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
export const RAIZ = path.resolve(import.meta.dirname, '..', '..')
export const MUNDO_PADRAO = path.join(
  process.env.TEMP ?? process.env.TMPDIR ?? '/tmp',
  'vistoria-fluxograma',
  'mundo'
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const powershell = (comando) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], {
    encoding: 'utf8',
    windowsHide: true
  })

export function montarMundo(mundo = MUNDO_PADRAO) {
  const saida = execFileSync(
    'python',
    [path.join(RAIZ, 'tools', 'vistoria-fluxograma', 'preparar-estado.py'), mundo],
    { encoding: 'utf8' }
  )
  return saida.trim()
}

/** Processos vivos cuja linha de comando cita o mundo de teste (a ferramenta so mexe nesses). */
export function processosDoMundo(mundo = MUNDO_PADRAO, raizes = []) {
  const alvo = path.resolve(mundo).replaceAll('\\', '/').toLowerCase()
  const saida = powershell(
    'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }'
  )
  return saida
    .split(/\r?\n/u)
    .map((linha) => linha.split('\t'))
    .filter(
      ([pid, comando]) =>
        pid &&
        comando &&
        Number(pid) !== process.pid &&
        (raizes.includes(Number(pid)) || comando.replaceAll('\\', '/').toLowerCase().includes(alvo))
    )
    .map(([pid, comando]) => ({ pid: Number(pid), comando: comando.slice(0, 160) }))
}

/** Janelas visiveis de qualquer processo do mundo (deve ser nenhuma: o Orca de teste abre oculto). */
export function janelasVisiveisDoMundo(mundo = MUNDO_PADRAO, raizes = []) {
  const pids = processosDoMundo(mundo, raizes).map((p) => p.pid)
  if (pids.length === 0) {
    return []
  }
  const saida = powershell(
    `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { "$($_.Id)\`t$($_.MainWindowTitle)" }`
  )
  return saida.split(/\r?\n/u).filter(Boolean)
}

export async function encerrarMundo(mundo = MUNDO_PADRAO, raizes = []) {
  // O Orca recria o processo de terminal enquanto e morto: mata tudo de uma vez e confere de novo.
  for (let rodada = 0; rodada < 10; rodada++) {
    const vivos = processosDoMundo(mundo, raizes)
    if (vivos.length === 0) {
      return []
    }
    try {
      execFileSync('taskkill', ['/F', '/T', ...vivos.flatMap(({ pid }) => ['/PID', String(pid)])], {
        stdio: 'ignore',
        windowsHide: true
      })
    } catch {
      // Alguns ja sairam junto com o pai.
    }
    await sleep(800)
  }
  return processosDoMundo(mundo, raizes)
}

/**
 * Abre o Orca montado em RAIZ/out, escondido, com o perfil do mundo. Devolve { page, fechar, porta }.
 * `fechar()` desconecta, mata a arvore de processos do mundo e apaga o mundo (a menos que manter).
 */
export async function abrirOrcaDeTeste({
  mundo = MUNDO_PADRAO,
  porta,
  registro,
  manter = false,
  raiz = RAIZ
} = {}) {
  const perfil = path.join(mundo, 'perfil')
  const portaCdp = porta ?? 9560 + Math.floor(Math.random() * 300)
  const env = { ...process.env }
  for (const nome of Object.keys(env)) {
    if (/^(ORCA_|CLAUDE|AI_AGENT)/u.test(nome)) {
      delete env[nome]
    }
  }
  delete env.ELECTRON_RUN_AS_NODE
  Object.assign(env, {
    ORCA_BACKGROUND_LAUNCH: '1',
    ORCA_DEV_USER_DATA_PATH: perfil,
    ORCA_DEV_INSTANCE_KEY: 'vistoria-fluxograma',
    // Sem rede da conta: o perfil copiado e ligado a nuvem, o de teste nao fala com ela.
    ORCA_CLOUD_API_URL: 'http://127.0.0.1:9'
  })
  mkdirSync(path.join(mundo, 'logs'), { recursive: true })
  const log = openSync(path.join(mundo, 'logs', 'orca-de-teste.log'), 'a')
  const filho = spawn(require('electron'), ['.', `--remote-debugging-port=${portaCdp}`], {
    cwd: raiz,
    env,
    windowsHide: true,
    stdio: ['ignore', log, log]
  })
  closeSync(log)
  const limpar = async (browser) => {
    try {
      await browser?.close()
    } catch {
      // A conexao ja caiu.
    }
    const sobras = await encerrarMundo(mundo, [filho.pid])
    if (!manter) {
      rmSync(mundo, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    }
    return sobras
  }
  let browser
  try {
    const limite = Date.now() + 120_000
    for (;;) {
      if (filho.exitCode !== null) {
        throw new Error(
          `O Orca de teste saiu antes de abrir (codigo ${filho.exitCode}). Veja ${path.join(mundo, 'logs', 'orca-de-teste.log')}`
        )
      }
      try {
        const resposta = await fetch(`http://127.0.0.1:${portaCdp}/json/version`)
        if (resposta.ok) {
          break
        }
      } catch {
        // Ainda subindo.
      }
      if (Date.now() > limite) {
        throw new Error('O Orca de teste nao abriu a porta de inspecao em 2 minutos.')
      }
      await sleep(500)
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${portaCdp}`)
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
    registro?.(`Orca de teste aberto (porta ${portaCdp}, ${filho.pid})`)
    return { page, porta: portaCdp, pid: filho.pid, fechar: () => limpar(browser) }
  } catch (erro) {
    await limpar(browser)
    throw erro
  }
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
