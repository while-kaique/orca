// Fork (o-050): a tab that a terminal exit closes is written to a line the main process appends to a file,
// so the first real close by X shows which branch removed each chat tab.
export const FORK_ABA_FECHADA_PREFIXO = '[fork-aba-fechada] '

export type ForkAbaFechadaLinha = {
  /** Which closing branch decided: see pty-exit-hibernate.ts. */
  ramo: string
  aba: string
  painel: string
  ptyId: string
  codigoDeSaida: number
  /** Milliseconds since this window loaded: a few seconds after opening means the restore, not the user. */
  msDesdeAbrir: number
  registroDeDormindo: { origem: string; estado: string; conversa: string } | null
  estadoDoAgente: string | null
  restaurado: boolean
  morteConfirmadaAoReabrir: boolean
  digitouNoTerminal: boolean
}

export function formatarLinhaDeAbaFechada(linha: ForkAbaFechadaLinha): string {
  return `${FORK_ABA_FECHADA_PREFIXO}${JSON.stringify(linha)}`
}

/** The record to append for a console message, or null when the message is not one of these lines. */
export function lerLinhaDeAbaFechada(
  mensagem: string,
  agora: Date
): (ForkAbaFechadaLinha & { em: string }) | null {
  if (!mensagem.startsWith(FORK_ABA_FECHADA_PREFIXO)) {
    return null
  }
  try {
    const dados = JSON.parse(mensagem.slice(FORK_ABA_FECHADA_PREFIXO.length)) as ForkAbaFechadaLinha
    return { em: agora.toISOString(), ...dados }
  } catch {
    return null
  }
}
