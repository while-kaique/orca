// Fork (PC-desk, o-041 parte 5): fechar o Orca pelo X, Alt+F4, menu Sair ou bandeja para os chats daquele Orca.
// Desligado no Orca oficial: so liga com ORCA_FORK_FECHAR_PARA_CHATS=1, posto pelo atalho "Orca (meu)".
import { execFile, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog, type BrowserWindow } from 'electron'
import { getDaemonProvider, listLiveDaemonSessions } from '../daemon/daemon-provider-state'
import { endHiddenSessions } from './fork-hidden-chat-sessions'
import { mainProcessState } from './main-process-state'
import { marcarTempoDoX } from './fork-close-timing'
import { askWindowToSuspendAllChats, closeSuspendingAllChats } from './fork-close-suspend-all'

export { marcarTempoDoX } from './fork-close-timing'
export {
  arvoreDosGuardas,
  stopForkChatTree,
  type PidDoGuarda,
  type Processo
} from './fork-close-chat-tree'

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
// Fork (o-051): a second X while the chats are being suspended must neither ask again nor close halfway.
let suspendendo = false
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

/** The list the question showed, for the cut record: looking at every chat again outran the cut deadline. */
function portaSalva(porta: Porta | null): string[] {
  try {
    const arquivo = join(app.getPath('userData'), 'fork-x-porta.json')
    writeFileSync(arquivo, JSON.stringify(porta))
    return porta ? ['--porta-salva', arquivo] : []
  } catch {
    return []
  }
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
  if (suspendendo) {
    return
  }
  void (async () => {
    marcarTempoDoX('porta-inicio')
    const porta = await rodarPorta([], PORTA_PRAZO_MS)
    marcarTempoDoX(`porta-fim:${porta ? (porta.pode ? 'pode' : 'pergunta') : 'sem-resposta'}`)
    if (porta?.pode) {
      // Fork (o-051): idle chats are suspended too, or the quit sweep would end them and their tabs would be lost.
      suspendendo = true
      await closeSuspendingAllChats({
        suspendAll: () => askWindowToSuspendAllChats(janela),
        recordCut: async () => {},
        proceed: () => {
          decidido = true
          seguir()
        },
        mark: marcarTempoDoX
      })
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
      ? `${linhas.join('\n')}${recentes}\n\nFechar suspende todos os chats do Claude deste Orca: a conversa de cada um fica guardada e eles voltam no mesmo card ao abrir de novo (um clique acorda o que estiver dormindo). O que estava no meio de uma resposta para.`
      : 'Não consegui conferir quais chats estão trabalhando. Fechar suspende todos os chats do Claude deste Orca: a conversa de cada um fica guardada.'
    const visivel = !janela.isDestroyed() && janela.isVisible()
    const opcoes = {
      type: 'warning' as const,
      title: 'Fechar o Orca',
      message: porta
        ? `${lista.length} chat(s) trabalhando neste Orca`
        : 'Fechar o Orca e suspender os chats',
      detail: detalhe,
      buttons: ['Fechar e suspender todos', 'Cancelar'],
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
    marcarTempoDoX('respondeu-fechar')
    suspendendo = true
    await closeSuspendingAllChats({
      suspendAll: () => askWindowToSuspendAllChats(janela),
      recordCut: () => rodarPorta(['--registrar-corte', ...portaSalva(porta)], CORTE_PRAZO_MS),
      proceed: () => {
        marcarTempoDoX('corte-registrado')
        decidido = true
        seguir()
      },
      mark: marcarTempoDoX
    })
  })()
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
