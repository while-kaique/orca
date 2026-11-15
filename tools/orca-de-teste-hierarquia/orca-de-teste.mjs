// Orca de teste da hierarquia: abre escondido, com perfil e pastas proprias, e deixa fechar pelo X, reabrir e
// contar processos sem tocar no Orca em uso. Usado pelos roteiros desta pasta (o-041).
import { execFileSync, spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import {
  atualizarTrava,
  pegarTravaDoOrcaDeTeste
} from '../vistoria-fluxograma/trava-do-orca-de-teste.mjs'
import { medir } from './portao-de-memoria.mjs'

const require = createRequire(import.meta.url)
/** Regra do PO (o-043, rodada final): para tudo se a memoria livre cair abaixo disto. */
export const PARAR_ABAIXO_GB = 4
export const RAIZ = path.resolve(import.meta.dirname, '..', '..')
export const MUNDO = path.join(process.env.TEMP ?? os.tmpdir(), 'orca-de-teste-hierarquia', 'mundo')
export const PERFIL = path.join(MUNDO, 'perfil')
export const PROJETOS = path.join(MUNDO, 'projetos')
/** O comando do Orca de teste: o `orca-dev` da maquina fixa o perfil do Orca em uso, este fixa o do mundo. */
export const CLI_DO_MUNDO = path.join(MUNDO, 'orca-teste.cmd')

export const esperar = (ms) => new Promise((pronto) => setTimeout(pronto, ms))

const powershell = (comando) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  })

function git(pasta, ...args) {
  execFileSync(
    'git',
    ['-c', 'user.name=teste', '-c', 'user.email=teste@example.invalid', ...args],
    {
      cwd: pasta,
      stdio: 'ignore',
      windowsHide: true
    }
  )
}

/** Projeto de teste: repositorio git com `.hierarquia/` vazio; os chats nascem na propria pasta (sem copia de trabalho). */
export function criarProjeto(nome) {
  const pasta = path.join(PROJETOS, nome)
  // Sobra de rodada anterior (um .git pela metade) faria o Orca recusar a pasta: sempre do zero.
  rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  mkdirSync(path.join(pasta, '.hierarquia', 'ordens'), { recursive: true })
  {
    git(pasta, 'init', '-q')
    writeFileSync(path.join(pasta, 'LEIAME.txt'), `projeto de teste ${nome}\n`)
    writeFileSync(path.join(pasta, '.gitignore'), '.hierarquia/\n')
    git(pasta, 'add', '.')
    git(pasta, 'commit', '-q', '-m', 'teste')
  }
  writeFileSync(path.join(pasta, '.hierarquia', 'registro.jsonl'), '')
  writeFileSync(
    path.join(pasta, '.hierarquia', 'config.json'),
    JSON.stringify({ pastaDosChats: 'projeto' })
  )
  return pasta
}

/** Copia o estado guardado do Orca em uso (so leitura) para o mundo e cria o comando do Orca de teste. */
export function montarMundo() {
  execFileSync(
    'python',
    [path.join(RAIZ, 'tools', 'vistoria-fluxograma', 'preparar-estado.py'), MUNDO],
    { encoding: 'utf8', windowsHide: true }
  )
  const cli = path.join(RAIZ, 'out', 'cli', 'index.js')
  writeFileSync(
    CLI_DO_MUNDO,
    [
      '@echo off',
      'setlocal',
      `set "ORCA_USER_DATA_PATH=${PERFIL}"`,
      'set NODE_OPTIONS=',
      'set ELECTRON_RUN_AS_NODE=1',
      `"${require('electron')}" "${cli}" %*`,
      ''
    ].join('\r\n')
  )
  return MUNDO
}

/** O ambiente de um comando que fala com o Orca de teste (orca e hierarquia), nunca com o em uso. */
export function ambienteDoMundo(extra = {}) {
  return {
    ...process.env,
    HIERARQUIA_ORCA: CLI_DO_MUNDO,
    HIERARQUIA_ORCA_DADOS: PERFIL,
    HIERARQUIA_VEZ: path.join(MUNDO, 'vez'),
    HIERARQUIA_INDICE: path.join(MUNDO, 'projetos-da-hierarquia.json'),
    ...extra
  }
}

/** O Orca de teste recem-aberto ainda nao atende (runtime_timeout): tenta de novo, ate 5 vezes. */
const AINDA_ABRINDO = new Set(['runtime_timeout', 'runtime_unavailable'])

export function orcaTeste(args, opcoes = {}) {
  for (let tentativa = 1; ; tentativa++) {
    const resposta = orcaTesteUmaVez(args, opcoes)
    if (resposta.ok !== false || !AINDA_ABRINDO.has(resposta.error?.code) || tentativa >= 5) {
      return resposta
    }
    execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 10'], {
      windowsHide: true
    })
  }
}

/** O .cmd roda pelo shell do Windows: argumento com espaco ou simbolo vai entre aspas. */
const citarArg = (arg) =>
  /^".*"$/su.test(arg) || !/[\s&|<>^()"]/u.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`

function orcaTesteUmaVez(args, { tempo = 240_000 } = {}) {
  let saida
  try {
    saida = execFileSync(CLI_DO_MUNDO, [...args.map(citarArg), '--json'], {
      encoding: 'utf8',
      shell: true,
      windowsHide: true,
      timeout: tempo,
      maxBuffer: 64 * 1024 * 1024
    })
  } catch (erro) {
    saida = String(erro.stdout ?? '')
    if (!saida.includes('{')) {
      throw erro
    }
  }
  return JSON.parse(saida.slice(saida.indexOf('{')))
}

/** Todos os processos da maquina: pid, pai, nome, linha de comando. */
export function processos() {
  const saida = powershell(
    'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.ParentProcessId)`t$($_.Name)`t$($_.CreationDate.ToString(\'o\'))`t$($_.CommandLine)" }'
  )
  return saida
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((linha) => {
      const [pid, pai, nome, criado, ...resto] = linha.split('\t')
      return { pid: Number(pid), pai: Number(pai), nome, criado, comando: resto.join('\t') }
    })
}

/** Descendentes de `raizes` pelo processo pai (pai precisa ter nascido antes do filho: pid reaproveitado nao conta). */
export function arvore(lista, raizes) {
  const porPid = new Map(lista.map((p) => [p.pid, p]))
  const dentro = new Set(raizes.filter((pid) => porPid.has(pid)))
  let mudou = true
  while (mudou) {
    mudou = false
    for (const p of lista) {
      const pai = porPid.get(p.pai)
      if (!dentro.has(p.pid) && dentro.has(p.pai) && pai && pai.criado <= p.criado) {
        dentro.add(p.pid)
        mudou = true
      }
    }
  }
  return lista.filter((p) => dentro.has(p.pid))
}

/** O pid do processo que guarda os terminais do Orca de teste (o daemon), lido do arquivo dele. */
export function pidDoGuardaTerminais() {
  const pasta = path.join(PERFIL, 'daemon')
  if (!existsSync(pasta)) {
    return []
  }
  return readdirSync(pasta)
    .filter((nome) => nome.endsWith('.pid'))
    .map((nome) => {
      try {
        return JSON.parse(readFileSync(path.join(pasta, nome), 'utf8')).pid
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** Processos do mundo: a arvore do Orca de teste e do guarda-terminais, mais tudo que cita a pasta do mundo. */
export function processosDoMundo(raizes = []) {
  const lista = processos()
  const alvo = path.resolve(MUNDO).replaceAll('\\', '/').toLowerCase()
  const citam = lista
    .filter(
      (p) =>
        p.pid !== process.pid &&
        p.comando.replaceAll('\\', '/').toLowerCase().includes(alvo) &&
        !/Get-CimInstance/u.test(p.comando)
    )
    .map((p) => p.pid)
  return arvore(lista, [...raizes, ...pidDoGuardaTerminais(), ...citam]).filter(
    (p) => p.pid !== process.pid && !/Get-CimInstance/u.test(p.comando)
  )
}

export function confiarNoMundo() {
  const arquivo = path.join(os.homedir(), '.claude.json')
  const config = JSON.parse(readFileSync(arquivo, 'utf8'))
  const raiz = path.resolve(MUNDO).replaceAll('\\', '/')
  config.projects ??= {}
  for (const pasta of [raiz, ...readdirSync(PROJETOS).map((n) => `${raiz}/projetos/${n}`)]) {
    config.projects[pasta] = { ...config.projects[pasta], hasTrustDialogAccepted: true }
  }
  writeFileSync(arquivo, JSON.stringify(config, null, 2))
}

export function desconfiarDoMundo() {
  const arquivo = path.join(os.homedir(), '.claude.json')
  const config = JSON.parse(readFileSync(arquivo, 'utf8'))
  const raiz = path.resolve(MUNDO).replaceAll('\\', '/')
  for (const pasta of Object.keys(config.projects ?? {})) {
    if (pasta.startsWith(raiz)) {
      delete config.projects[pasta]
    }
  }
  writeFileSync(arquivo, JSON.stringify(config, null, 2))
}

/**
 * Abre o Orca montado em RAIZ/out, escondido, com o perfil do mundo. `extraEnv` liga opcoes do fork.
 * Devolve { page, pid, porta, browser }.
 */
let soltarTrava = null

/** Trava unica da maquina (a da vistoria): pega uma vez por roteiro e solta quando o node sai; outro vivo = recusa. */
async function garantirTrava(porta, log) {
  if (soltarTrava) {
    return
  }
  soltarTrava = await pegarTravaDoOrcaDeTeste({
    esperarMin: 0,
    registro: log,
    dados: {
      dono: process.env.ORCA_DE_TESTE_DONO?.trim() || `planejador o-043 (${RAIZ})`,
      pasta: RAIZ,
      raiz: RAIZ,
      mundo: MUNDO,
      pidNode: process.pid,
      pidElectron: null,
      porta,
      comando: process.argv.slice(1).join(' ').slice(0, 300),
      desde: new Date().toISOString()
    }
  })
  process.on('exit', soltarTrava)
  // Abaixo de 4 GB livres: encerra o mundo e sai, sem esperar o roteiro.
  const vigia = setInterval(() => {
    let livre
    try {
      livre = medir().livreGB
    } catch {
      return
    }
    if (livre > 0 && livre < PARAR_ABAIXO_GB) {
      clearInterval(vigia)
      log(
        `MEMORIA: ${livre} GB livres (< ${PARAR_ABAIXO_GB}); paro o roteiro e encerro o mundo de teste`
      )
      void encerrarMundo().finally(() => process.exit(4))
    }
  }, 15_000)
  vigia.unref()
}

export async function abrirOrca({ extraEnv = {}, log = console.log } = {}) {
  const porta = 9860 + Math.floor(Math.random() * 100)
  await garantirTrava(porta, log)
  const env = { ...process.env }
  for (const nome of Object.keys(env)) {
    if (/^(ORCA_|CLAUDE|AI_AGENT|HIERARQUIA_)/u.test(nome)) {
      delete env[nome]
    }
  }
  delete env.ELECTRON_RUN_AS_NODE
  Object.assign(env, {
    ORCA_BACKGROUND_LAUNCH: '1',
    ORCA_DEV_USER_DATA_PATH: PERFIL,
    ORCA_DEV_INSTANCE_KEY: 'orca-de-teste-hierarquia',
    ORCA_CLOUD_API_URL: 'http://127.0.0.1:9',
    ...extraEnv
  })
  mkdirSync(path.join(MUNDO, 'logs'), { recursive: true })
  const log1 = openSync(path.join(MUNDO, 'logs', 'orca.log'), 'a')
  // A marca com a pasta do mundo na linha de comando: a limpeza acha so este Orca, nunca o de outra ferramenta.
  const filho = spawn(
    require('electron'),
    ['.', `--remote-debugging-port=${porta}`, `--mundo-de-teste=${MUNDO}`],
    { cwd: RAIZ, env, windowsHide: true, stdio: ['ignore', log1, log1] }
  )
  closeSync(log1)
  atualizarTrava({ pidElectron: filho.pid, porta })
  const limite = Date.now() + 180_000
  for (;;) {
    if (filho.exitCode !== null) {
      throw new Error(`O Orca de teste saiu antes de abrir (codigo ${filho.exitCode}).`)
    }
    try {
      if ((await fetch(`http://127.0.0.1:${porta}/json/version`)).ok) {
        break
      }
    } catch {
      // subindo
    }
    if (Date.now() > limite) {
      throw new Error('O Orca de teste nao abriu em 3 min.')
    }
    await esperar(500)
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${porta}`)
  let page
  while (!page) {
    page = browser
      .contexts()[0]
      ?.pages()
      .find((p) => !p.url().startsWith('devtools'))
    if (!page) {
      await esperar(300)
    }
  }
  // A montagem do fork nao expoe o __store: basta a lista de projetos desenhada.
  await page.waitForFunction(() => (document.body?.innerText ?? '').includes('Projetos'), null, {
    timeout: 180_000
  })
  log(`Orca de teste aberto (pid ${filho.pid}, porta ${porta})`)
  return { page, pid: filho.pid, porta, browser, processo: filho }
}

const FECHAR_COMO_O_X = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class FecharComoOX {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static string Enviar(uint alvo) {
    var achadas = new StringBuilder();
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p != alvo) { return true; }
      var c = new StringBuilder(256); GetClassName(h, c, 256);
      var t = new StringBuilder(256); GetWindowText(h, t, 256);
      if (c.ToString() == "Chrome_WidgetWin_1" && t.Length > 0) {
        PostMessage(h, 0x0112, (IntPtr)0xF060, IntPtr.Zero);
        achadas.Append(t.ToString()).Append(";");
      }
      return true;
    }, IntPtr.Zero);
    return achadas.ToString();
  }
}
"@
`

/**
 * Fecha a janela como o X do canto: manda a ela a mensagem do Windows que o botao X e o Alt+F4 mandam (SC_CLOSE),
 * mesmo com a janela escondida. O `window.close()` da pagina nao passa pelo evento de fechar da janela (o-043).
 */
export async function fecharPeloX(orca, { prazoMs = 90_000 } = {}) {
  const janelas = powershell(`${FECHAR_COMO_O_X}; [FecharComoOX]::Enviar(${orca.pid})`).trim()
  orca.fechadoPor = janelas
    ? `SC_CLOSE nas janelas: ${janelas}`
    : 'window.close (nenhuma janela achada)'
  if (!janelas) {
    await orca.page.evaluate(() => window.close()).catch(() => null)
  }
  // Com terminal rodando, o proprio Orca pergunta antes ("Close Window?"); a janela de teste e escondida, entao o
  // roteiro responde "Close" por ela e o fechamento segue para a pergunta do fork.
  for (let i = 0; i < 30 && orca.processo.exitCode === null; i++) {
    const respondeu = await orca.page
      .evaluate(() => {
        const dialogo = [...document.querySelectorAll('[role="dialog"]')].find((el) =>
          /Close Window|Fechar a janela|Fechar janela/iu.test(el.textContent ?? '')
        )
        const botoes = dialogo ? [...dialogo.querySelectorAll('button')] : []
        botoes.at(-1)?.click()
        return dialogo ? (dialogo.textContent ?? '').replace(/\s+/gu, ' ').slice(0, 200) : null
      })
      .catch(() => null)
    if (respondeu) {
      orca.fechadoPor += ` | o Orca perguntou antes e o teste respondeu Close: "${respondeu}"`
      break
    }
    await esperar(1000)
  }
  const limite = Date.now() + prazoMs
  while (orca.processo.exitCode === null && Date.now() < limite) {
    await esperar(250)
  }
  await orca.browser.close().catch(() => null)
  return orca.processo.exitCode !== null
}

/** Mata so os processos do mundo (Orca de teste, guarda-terminais e chats dele) e confere. */
export async function encerrarMundo(raizes = []) {
  for (let rodada = 0; rodada < 10; rodada++) {
    const vivos = processosDoMundo(raizes)
    if (vivos.length === 0) {
      return []
    }
    try {
      execFileSync('taskkill', ['/F', '/T', ...vivos.flatMap(({ pid }) => ['/PID', String(pid)])], {
        stdio: 'ignore',
        windowsHide: true
      })
    } catch {
      // alguns ja sairam
    }
    await esperar(800)
  }
  return processosDoMundo(raizes)
}

/** Contagem para o teto de memoria da o-043: Orcas de teste abertos e chats Claude do mundo vivos. */
export function contarDoMundo(raizes = []) {
  const vivos = processosDoMundo(raizes)
  return {
    orcas: vivos.filter((p) => /--mundo-de-teste=/u.test(p.comando) && !/--type=/u.test(p.comando))
      .length,
    claudes: vivos.filter((p) => /^claude/iu.test(p.nome)).length,
    processos: vivos.length
  }
}

/** Confere a contagem a cada 20 s e guarda o maximo visto; `parar()` devolve { orcas, claudes }. */
export function vigiarTeto(raizes, dizer) {
  const maximo = { orcas: 0, claudes: 0 }
  const conferir = () => {
    try {
      const agora = contarDoMundo(raizes())
      if (agora.orcas > maximo.orcas || agora.claudes > maximo.claudes) {
        maximo.orcas = Math.max(maximo.orcas, agora.orcas)
        maximo.claudes = Math.max(maximo.claudes, agora.claudes)
        dizer(`teto: maximo ate aqui ${maximo.orcas} Orca de teste, ${maximo.claudes} Claude vivos`)
        if (agora.claudes > 3) {
          // Quais sao: chat de teste, ou outro processo com nome claude (atualizador, subagente)?
          const claudes = processosDoMundo(raizes()).filter((p) => /^claude/iu.test(p.nome))
          dizer(
            `  processos claude: ${claudes.map((p) => `${p.pid}<-${p.pai} ${p.comando.slice(0, 140)}`).join(' | ')}`
          )
        }
      }
    } catch {
      // a contagem e so para o relato
    }
  }
  conferir()
  const timer = setInterval(conferir, 20_000)
  return {
    parar: () => {
      clearInterval(timer)
      conferir()
      return maximo
    }
  }
}

export function apagarMundo() {
  rmSync(MUNDO, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
