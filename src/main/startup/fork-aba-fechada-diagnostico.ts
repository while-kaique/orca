// Fork (o-050): the window's console notes on which branch closed a chat tab, kept in a file next to fork-x-tempos.jsonl.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, type WebContents } from 'electron'
import { lerLinhaDeAbaFechada } from '../../shared/fork-aba-fechada-diagnostico'
import { forkCloseStopsChatsEnabled } from './fork-close-stops-chats'

/** Appends one JSON line per note; the file is evidence only, so a failed write never reaches the user. */
export function gravarAbaFechadaDoConsole(
  mensagem: string,
  pasta: string,
  agora = new Date()
): void {
  const linha = lerLinhaDeAbaFechada(mensagem, agora)
  if (!linha) {
    return
  }
  try {
    appendFileSync(join(pasta, 'fork-abas-fechadas.jsonl'), `${JSON.stringify(linha)}\n`)
  } catch {
    // Evidence only.
  }
}

export function installForkAbaFechadaDiagnostico(webContents: WebContents): void {
  if (!forkCloseStopsChatsEnabled()) {
    return
  }
  webContents.on('console-message', (details) => {
    gravarAbaFechadaDoConsole(details.message, app.getPath('userData'))
  })
}
