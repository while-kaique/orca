// Fork (PC-desk, o-041 parte 5): fechar o Orca pelo X, Alt+F4, menu Sair ou bandeja para os chats daquele Orca.
// Desligado no Orca oficial: so liga com ORCA_FORK_FECHAR_PARA_CHATS=1, posto pelo atalho "Orca (meu)".
import { execFile, spawn } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog, type BrowserWindow } from 'electron'
import { getDaemonProvider, listLiveDaemonSessions } from '../daemon/daemon-provider-state'
import { endHiddenSessions } from './fork-hidden-chat-sessions'
import { mainProcessState } from './main-process-state'

const PORTA_PRAZO_MS = 25_000
const CORTE_PRAZO_MS = 10_000

type ChatNaPorta = {
  projeto: string | null
  papel: string
  ordemId: string | null
  titulo: string | null
  desde: string | null
  segundoPlano: number
  livre: boolean
}
type Porta = { pode: boolean; resumo: string; chats: ChatNaPorta[]; recentes: unknown[] }

let decidido = false
let sessaoDoWindowsTerminando = false

export function forkCloseStopsChatsEnabled(): boolean {
  return process.env.ORCA_FORK_FECHAR_PARA_CHATS === '1'
}

/** Windows desligando ou saindo da conta: fecha e para tudo sem perguntar. */
export function markOsSessionEnding(): void {
  sessaoDoWindowsTerminando = true
}

function rodarPorta(extra: string[], prazoMs: number): Promise<Porta | null> {
  const script = process.env.ORCA_FORK_PORTA
  if (!script) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [script, 'porta', '--rapido', '--json', ...extra],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: prazoMs,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          HIERARQUIA_ORCA_DADOS: process.env.HIERARQUIA_ORCA_DADOS ?? app.getPath('userData')
        }
      },
      (_erro, saida) => {
        try {
          const texto = String(saida ?? '')
          resolve(JSON.parse(texto.slice(texto.indexOf('{'))) as Porta)
        } catch {
          resolve(null)
        }
      }
    )
  })
}

function nomeDoProjeto(pasta: string | null): string {
  return (
    String(pasta ?? '')
      .split(/[\\/]/u)
      .findLast(Boolean) ?? ''
  )
}

function linhaDoChat(chat: ChatNaPorta): string {
  const quem = chat.livre ? 'chat livre' : chat.papel
  const desde = chat.desde
    ? ` desde ${new Date(chat.desde).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : ''
  const fundo = chat.segundoPlano ? ', com comando em segundo plano' : ''
  return `- ${nomeDoProjeto(chat.projeto)}: ${quem}${chat.ordemId ? ` (${chat.ordemId})` : ''} "${String(chat.titulo ?? '').slice(0, 60)}"${desde}${fundo}`
}

/**
 * Mostra a pergunta. O Orca de teste (janela escondida) nunca abre janela na tela de quem usa a maquina: com
 * ORCA_FORK_X_TESTE_RESPOSTA ele grava a pergunta em ORCA_FORK_X_TESTE_SAIDA e responde sozinho.
 */
async function perguntar(
  janela: BrowserWindow,
  visivel: boolean,
  opcoes: Electron.MessageBoxOptions
): Promise<{ response: number }> {
  const resposta = process.env.ORCA_FORK_X_TESTE_RESPOSTA
  if (resposta) {
    const saida = process.env.ORCA_FORK_X_TESTE_SAIDA
    if (saida) {
      writeFileSync(
        saida,
        `${opcoes.title}\n${opcoes.message}\n\n${opcoes.detail}\n\n[${(opcoes.buttons ?? []).join('] [')}]\nresposta do teste: ${resposta}\n`
      )
    }
    return { response: resposta === 'fechar' ? 0 : 1 }
  }
  return visivel ? dialog.showMessageBox(janela, opcoes) : dialog.showMessageBox(opcoes)
}

/** Fechar a janela principal passa por aqui uma vez: true segura o fechamento e decide antes. */
export function forkCloseGateHolds(): boolean {
  return forkCloseStopsChatsEnabled() && !decidido && !sessaoDoWindowsTerminando
}

/**
 * Pergunta so quando ha chat trabalhando. `seguir` fecha de novo (agora liberado); `desistir` volta ao normal.
 * Sem resposta da porta, pergunta do mesmo jeito: nunca fecha calado nem prende sem saida.
 */
export function askForkCloseGate(
  janela: BrowserWindow,
  seguir: () => void,
  desistir: () => void
): void {
  void (async () => {
    const porta = await rodarPorta([], PORTA_PRAZO_MS)
    if (porta?.pode) {
      decidido = true
      seguir()
      return
    }
    const lista = porta?.chats ?? []
    const linhas = lista.slice(0, 12).map(linhaDoChat)
    if (lista.length > 12) {
      linhas.push(`... e mais ${lista.length - 12}`)
    }
    const recentes = porta?.recentes?.length
      ? `\n${porta.recentes.length} ordem(ns) lancada(s) ha pouco: o chat ainda pode estar nascendo.`
      : ''
    const detalhe = porta
      ? `${linhas.join('\n')}${recentes}\n\nFechar agora para estes chats no meio. Ao abrir de novo, eles voltam e retomam a conversa; o que estava rodando se perde.`
      : 'Nao consegui conferir quais chats estao trabalhando. Fechar agora para todos os chats deste Orca.'
    const visivel = !janela.isDestroyed() && janela.isVisible()
    const opcoes = {
      type: 'warning' as const,
      title: 'Fechar o Orca',
      message: porta
        ? `${lista.length} chat(s) trabalhando neste Orca`
        : 'Fechar o Orca para todos os chats',
      detail: detalhe,
      buttons: ['Fechar e parar todos', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    }
    const { response } = await perguntar(janela, visivel, opcoes)
    if (response !== 0) {
      desistir()
      return
    }
    // A hierarquia anota quem foi cortado: ao reabrir, a volta avisa cada um (so com o Claude aberto).
    await rodarPorta(['--registrar-corte'], CORTE_PRAZO_MS)
    decidido = true
    seguir()
  })()
}

type PidDoGuarda = { pid: number; startedAtMs: number | null }

function guardasDeTerminais(): PidDoGuarda[] {
  const pasta = join(app.getPath('userData'), 'daemon')
  try {
    return readdirSync(pasta)
      .filter((nome) => nome.endsWith('.pid'))
      .map((nome) => {
        try {
          const dados = JSON.parse(readFileSync(join(pasta, nome), 'utf8'))
          return { pid: Number(dados.pid), startedAtMs: Number(dados.startedAtMs) || null }
        } catch {
          return null
        }
      })
      .filter((item): item is PidDoGuarda => Boolean(item?.pid))
  } catch {
    return []
  }
}

function rodar(comando: string, args: string[], prazoMs: number): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      comando,
      args,
      { encoding: 'utf8', windowsHide: true, timeout: prazoMs },
      (_erro, saida) => resolve(String(saida ?? ''))
    )
  })
}

type Processo = { pid: number; pai: number; nascido: number }

/** Todos os processos da maquina com pai e hora de nascimento (Windows). */
async function fotoDosProcessos(): Promise<Processo[]> {
  const saida = await rodar(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.ParentProcessId)`t$(if ($_.CreationDate) { [DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds() } else { 0 })" }'
    ],
    10_000
  )
  return saida
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((linha) => {
      const [pid, pai, nascido] = linha.split('\t').map(Number)
      return { pid, pai, nascido }
    })
}

/**
 * A arvore dos guardas de terminais deste Orca pelo processo pai. O pid do arquivo so vale se o processo vivo nasceu
 * junto com o guarda daquele arquivo (pid reaproveitado por outro programa nunca entra); o filho tem de ter nascido
 * depois do pai.
 */
function arvoreDosGuardas(lista: Processo[], guardas: PidDoGuarda[]): Processo[] {
  const porPid = new Map(lista.map((p) => [p.pid, p]))
  const dentro = new Set(
    guardas
      .filter((g) => {
        const vivo = porPid.get(g.pid)
        return vivo && (g.startedAtMs === null || Math.abs(vivo.nascido - g.startedAtMs) < 15_000)
      })
      .map((g) => g.pid)
  )
  for (let mudou = true; mudou;) {
    mudou = false
    for (const p of lista) {
      const pai = porPid.get(p.pai)
      if (!dentro.has(p.pid) && dentro.has(p.pai) && pai && pai.nascido <= p.nascido) {
        dentro.add(p.pid)
        mudou = true
      }
    }
  }
  return lista.filter((p) => dentro.has(p.pid))
}

/**
 * Para os chats deste Orca: guarda a arvore dos guardas de terminais (claude, claude.exe.old, node, python, shells),
 * pede o desligamento normal do guarda e depois mata o que sobrou daquela arvore, conferindo pid e hora de nascimento.
 * Nunca por nome: outro Orca e Claude fora do Orca nao estao nessa arvore.
 */
export async function stopForkChatTree(desligarGuarda: () => Promise<void>): Promise<void> {
  const guardas = guardasDeTerminais()
  const antes =
    process.platform === 'win32' && guardas.length > 0
      ? arvoreDosGuardas(await fotoDosProcessos(), guardas)
      : []
  await Promise.race([desligarGuarda().catch(() => {}), new Promise((r) => setTimeout(r, 4_000))])
  if (antes.length === 0) {
    return
  }
  const agora = new Map((await fotoDosProcessos()).map((p) => [p.pid, p]))
  const sobras = antes.filter((p) => agora.get(p.pid)?.nascido === p.nascido)
  for (let i = 0; i < sobras.length; i += 40) {
    const lote = sobras.slice(i, i + 40)
    await rodar('taskkill', ['/F', '/T', ...lote.flatMap((p) => ['/PID', String(p.pid)])], 5_000)
  }
}

const VOLTA_DEPOIS_DE_ABRIR_MS = 45_000

/**
 * A volta (o-041 parte 4): pouco depois de o Orca do fork abrir, a hierarquia liga os vigias com trabalho pendente
 * (chat cortado, aviso guardado, ordem aberta). Processo solto, sem janela; o Orca oficial nunca roda isto.
 */
export function scheduleForkVolta(): void {
  const script = process.env.ORCA_FORK_PORTA
  if (!forkCloseStopsChatsEnabled() || !script) {
    return
  }
  void app.whenReady().then(() => {
    const openedAtMs = Date.now()
    const timer = setTimeout(async () => {
      // Chats a crash left running without a tab are ended first; `retomar` then warns their creators.
      try {
        const sessions = await listLiveDaemonSessions()
        const provider = getDaemonProvider()
        if (sessions && provider) {
          await endHiddenSessions({
            sessions,
            session: mainProcessState.store?.getWorkspaceSession(),
            orcaOpenedAtMs: openedAtMs,
            shutdown: (sessionId) => provider.shutdown(sessionId, { immediate: true })
          })
        }
      } catch {
        // Without the sweep, hidden chats keep running until the next close by X ends the whole tree.
      }
      try {
        const filho = spawn(process.execPath, [script, 'retomar'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            HIERARQUIA_ORCA_DADOS: process.env.HIERARQUIA_ORCA_DADOS ?? app.getPath('userData')
          }
        })
        filho.unref()
      } catch {
        // Sem a volta automatica, o proximo comando da hierarquia em cada chat liga o vigia.
      }
    }, VOLTA_DEPOIS_DE_ABRIR_MS)
    timer.unref?.()
  })
}
