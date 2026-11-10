import { createPortal } from 'react-dom'
import type { Terminal } from '@xterm/xterm'
import { SessionRestoredBanner } from './SessionRestoredBanner'
import type {
  SessionRestoredBannerPane,
  SessionRestoredBannerPaneReasons
} from './session-restored-banner-pane-state'

type SessionRestoredBannerPortalsProps = {
  panes: readonly (SessionRestoredBannerPane & { terminal?: Terminal })[]
  paneIds: SessionRestoredBannerPaneReasons
  tabId?: string
}

export function SessionRestoredBannerPortals({
  panes,
  paneIds,
  tabId
}: SessionRestoredBannerPortalsProps): React.JSX.Element {
  return (
    <>
      {panes.map((pane) => {
        const reason = paneIds.get(pane.id)
        if (!reason) {
          return null
        }
        return createPortal(
          // Put wake markers in pane chrome because resumed TUIs immediately repaint the PTY screen.
          <SessionRestoredBanner visible reason={reason} terminal={pane.terminal} tabId={tabId} />,
          pane.container,
          `session-restored-banner-${pane.id}`
        )
      })}
    </>
  )
}
