import NativeChatView from '../native-chat/NativeChatView'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

/** The open card's chat screen: the same view the terminal pane shows over its terminal, sending to this chat's PTY. */
export function CanvasChatScreen({
  tabId,
  paneKey,
  ptyId,
  launchAgent,
  onSwitchToTerminal
}: {
  tabId: string
  paneKey: string | null
  ptyId: string
  launchAgent: TuiAgent | null
  onSwitchToTerminal: () => void
}): React.JSX.Element {
  return (
    <div className="cc-chat-screen">
      <NativeChatView
        terminalTabId={tabId}
        isVisible
        isFocusedGroup
        paneKey={paneKey ?? undefined}
        targetPtyId={ptyId}
        launchAgent={launchAgent}
        ownsTabWideLaunchDraft
        onSwitchToTerminal={onSwitchToTerminal}
      />
    </div>
  )
}
