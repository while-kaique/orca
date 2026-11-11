import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import { terminalPreviewUnavailableMessage } from '../dashboard-popout/terminal-preview-unavailable-message'
import { ChatRestoreLoading } from '../terminal-pane/SessionRestoredBanner'
import { canvasChatLinkHandlers } from './canvas-chat-terminal-links'
import {
  CANVAS_GRID_CLAIMS,
  CANVAS_HISTORY_ROWS,
  useCanvasChatTerminalWake
} from './use-canvas-chat-terminal-wake'

/** The open chat's live terminal; a chat still asleep after a restart shows "Restaurando o chat…" until it is back. */
export function CanvasChatTerminal({
  tabId,
  livePty,
  terminalReady,
  background,
  onWake
}: {
  tabId: string
  livePty: string | null
  terminalReady: boolean
  background: string | undefined
  onWake: () => void
}): React.JSX.Element {
  const wake = useCanvasChatTerminalWake({ tabId, livePty, onWake })
  return (
    <div className="cc-terminal-wrap">
      {livePty && terminalReady ? (
        <AgentTerminalPreview
          key={`${livePty}:${wake.connectAttempt}`}
          ptyId={livePty}
          terminalInput={null}
          linkHandlers={canvasChatLinkHandlers}
          historyRows={CANVAS_HISTORY_ROWS}
          gridClaimsPerSize={CANVAS_GRID_CLAIMS}
          onAvailability={wake.onAvailability}
          className="cc-terminal"
        />
      ) : (
        <div className="cc-terminal" />
      )}
      {wake.gaveUp ? (
        <div className="cc-terminal-gone">
          {terminalPreviewUnavailableMessage({ ptyId: livePty })}
        </div>
      ) : wake.restoreSeconds >= 0 ? (
        <ChatRestoreLoading seconds={wake.restoreSeconds} background={background} />
      ) : null}
    </div>
  )
}
