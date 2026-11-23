import { useState } from 'react'
import { useAppStore } from '@/store'
import { MessageSquare, SquareTerminal } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import { terminalPreviewUnavailableMessage } from '../dashboard-popout/terminal-preview-unavailable-message'
import { canvasChatLinkHandlers } from './canvas-chat-terminal-links'
import { CanvasChatScreen } from './CanvasChatScreen'
import { CanvasChatWakeMask } from './CanvasChatWakeMask'
import { useCanvasChatScreenChoice } from './canvas-chat-screen-choice'
import {
  CANVAS_GRID_CLAIMS,
  CANVAS_HISTORY_ROWS,
  useCanvasChatTerminalWake
} from './use-canvas-chat-terminal-wake'

/**
 * The open chat: its chat screen when the agent and conversation allow it, else its live terminal.
 * A chat still asleep after a restart shows the steps of its waking until it is back.
 */
export function CanvasChatTerminal({
  worktreeId,
  tabId,
  paneKey,
  livePty,
  terminalReady,
  onWake,
  background
}: {
  worktreeId: string
  tabId: string
  paneKey: string | null
  livePty: string | null
  terminalReady: boolean
  onWake: () => void
  /** Names of the agents and commands this chat left running, shown so a quiet chat is not mistaken for idle. */
  background: readonly string[]
}): React.JSX.Element {
  const wake = useCanvasChatTerminalWake({ tabId, livePty, onWake })
  const screen = useCanvasChatScreenChoice({ worktreeId, tabId, paneKey })
  // The terminal is the proof that the PTY behind a saved id exists; the chat screen takes over once it answered.
  const [provenPty, setProvenPty] = useState<string | null>(null)
  // Claude's SessionStart hook, after this wake began, is the conversation coming back.
  const wakeStartedAt = wake.wakeStartedAt
  const conversationLoaded = useAppStore(
    (s) =>
      wakeStartedAt !== null &&
      Object.values(s.agentStatusByPaneKey).some(
        (entry) => entry.tabId === tabId && entry.stateStartedAt >= wakeStartedAt
      )
  )
  const showChat =
    screen.mode === 'chat' &&
    livePty !== null &&
    terminalReady &&
    provenPty === livePty &&
    !wake.gaveUp &&
    wake.restoreSeconds < 0
  return (
    <div className="cc-terminal-wrap">
      {screen.available || background.length > 0 ? (
        <div className="cc-screen-bar">
          {background.length > 0 ? (
            <span className="cc-screen-bg" title={background.join(', ')}>
              <span className="cc-spin" />
              <span>
                {translate('fork.canvas.screenBackground', 'Rodando em segundo plano: {{names}}', {
                  names: background.join(', ')
                })}
              </span>
            </span>
          ) : null}
          {screen.available ? (
            <button
              type="button"
              className="cc-screen-switch"
              onClick={() => screen.setMode(screen.mode === 'chat' ? 'terminal' : 'chat')}
            >
              {screen.mode === 'chat' ? <SquareTerminal size={12} /> : <MessageSquare size={12} />}
              {screen.mode === 'chat'
                ? translate('fork.canvas.screenShowTerminal', 'Ver o terminal')
                : translate('fork.canvas.screenShowChat', 'Ver a tela de chat')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showChat && livePty ? (
        <CanvasChatScreen
          tabId={tabId}
          paneKey={paneKey}
          ptyId={livePty}
          launchAgent={screen.launchAgent}
          onSwitchToTerminal={() => screen.setMode('terminal')}
        />
      ) : livePty && terminalReady ? (
        <AgentTerminalPreview
          key={`${livePty}:${wake.connectAttempt}`}
          ptyId={livePty}
          terminalInput={null}
          linkHandlers={canvasChatLinkHandlers}
          historyRows={CANVAS_HISTORY_ROWS}
          gridClaimsPerSize={CANVAS_GRID_CLAIMS}
          onAvailability={(available) => {
            wake.onAvailability(available)
            if (available) {
              setProvenPty(livePty)
            }
          }}
          className="cc-terminal"
        />
      ) : (
        <div className="cc-terminal" />
      )}
      {wake.gaveUp || wake.restoreSeconds >= 0 ? (
        <CanvasChatWakeMask
          facts={{
            terminalAnswered: livePty !== null && provenPty === livePty && !wake.terminalGone,
            conversationLoaded,
            gaveUp: wake.gaveUp
          }}
          problemReason={terminalPreviewUnavailableMessage({ ptyId: livePty })}
        />
      ) : null}
    </div>
  )
}
