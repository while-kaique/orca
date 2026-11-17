import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { anotarAbaDeChat, lerAbaDeChat } from './fork-aba-fechada-diagnostico'

describe('fork aba fechada diagnostico (tela)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useAppStore.setState({ sleepingAgentSessionsByPaneKey: {}, agentStatusByPaneKey: {} })
  })

  it('reads the sleeping record of a chat pane and skips a plain shell pane', () => {
    useAppStore.setState({
      sleepingAgentSessionsByPaneKey: {
        'tab-1:leaf-1': {
          paneKey: 'tab-1:leaf-1',
          worktreeId: 'wt',
          agent: 'claude',
          providerSession: { key: 'session_id', id: 'dc17dfe2-30e1-45b2-87f4-de824d21b7fd' },
          prompt: '',
          state: 'working',
          capturedAt: 1,
          updatedAt: 1,
          origin: 'quit'
        }
      },
      agentStatusByPaneKey: {}
    } as never)
    expect(lerAbaDeChat({ tabId: 'tab-1', paneKey: 'tab-1:leaf-1' })).toEqual({
      aba: 'tab-1',
      painel: 'tab-1:leaf-1',
      registroDeDormindo: { origem: 'quit', estado: 'working', conversa: 'dc17dfe2' },
      estadoDoAgente: null
    })
    expect(lerAbaDeChat({ tabId: 'tab-2', paneKey: 'tab-2:leaf-1' })).toBeNull()
  })

  it('writes one console line per chat tab and nothing for a plain shell', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const campos = {
      ramo: 'painel-unico-fecha-aba',
      ptyId: 'pty-9',
      codigoDeSaida: 0,
      restaurado: true,
      morteConfirmadaAoReabrir: false,
      digitouNoTerminal: false
    }
    anotarAbaDeChat(null, campos)
    expect(aviso).not.toHaveBeenCalled()
    anotarAbaDeChat(
      { aba: 'tab-1', painel: 'tab-1:leaf-1', registroDeDormindo: null, estadoDoAgente: 'working' },
      campos
    )
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(String(aviso.mock.calls[0][0]).startsWith('[fork-aba-fechada] {"aba":"tab-1"')).toBe(
      true
    )
    expect(String(aviso.mock.calls[0][0])).toContain('"ramo":"painel-unico-fecha-aba"')
  })
})
