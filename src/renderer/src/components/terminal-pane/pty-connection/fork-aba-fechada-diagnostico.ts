// Fork (o-050): evidence of which branch closes (or keeps) a chat tab when its terminal is found dead.
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import {
  formatarLinhaDeAbaFechada,
  type ForkAbaFechadaLinha
} from '../../../../../shared/fork-aba-fechada-diagnostico'

export type AbaDeChatNoDiagnostico = Pick<
  ForkAbaFechadaLinha,
  'registroDeDormindo' | 'estadoDoAgente' | 'painel' | 'aba'
>

type PaneRecordSource = { tabId: string; paneKey: string }

/** What the store knows about the pane's conversation; null for a plain shell, which is not a chat tab. */
export function lerAbaDeChat(source: PaneRecordSource): AbaDeChatNoDiagnostico | null {
  const state = useAppStore.getState()
  const record = state.sleepingAgentSessionsByPaneKey[source.paneKey]
  const status = state.agentStatusByPaneKey[source.paneKey]
  if (!record && !status) {
    return null
  }
  return {
    aba: source.tabId,
    painel: source.paneKey,
    registroDeDormindo: record
      ? {
          origem: record.origin ?? 'sem-origem',
          estado: record.state,
          conversa: String(record.providerSession?.id ?? '').slice(0, 8)
        }
      : null,
    estadoDoAgente: status?.state ?? null
  }
}

export function anotarAbaDeChat(
  aba: AbaDeChatNoDiagnostico | null,
  campos: Pick<
    ForkAbaFechadaLinha,
    | 'ramo'
    | 'ptyId'
    | 'codigoDeSaida'
    | 'restaurado'
    | 'morteConfirmadaAoReabrir'
    | 'digitouNoTerminal'
  >
): void {
  if (!aba) {
    return
  }
  console.warn(
    formatarLinhaDeAbaFechada({
      ...aba,
      ...campos,
      msDesdeAbrir: Math.round(performance.now())
    })
  )
}

/** For the closer that has no pane session: a hidden tab's watcher. */
export function anotarAbaFechadaPorVigiaEscondido(args: {
  tabId: string
  leafId: string
  ptyId: string
  codigoDeSaida: number
}): void {
  anotarAbaDeChat(
    lerAbaDeChat({ tabId: args.tabId, paneKey: makePaneKey(args.tabId, args.leafId) }),
    {
      ramo: 'vigia-de-aba-escondida-fecha-aba',
      ptyId: args.ptyId,
      codigoDeSaida: args.codigoDeSaida,
      restaurado: false,
      morteConfirmadaAoReabrir: false,
      digitouNoTerminal: false
    }
  )
}
