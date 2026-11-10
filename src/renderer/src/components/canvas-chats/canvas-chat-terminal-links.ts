import type { PreviewTerminalLinkHandler } from '../dashboard-popout/preview-terminal-links'

/**
 * Fork: in the flowchart's open chat, a click on a link (artifact, localhost page, any http link) opens it in
 * the system's default browser right away. The preview terminal alone only reacts to Ctrl+click.
 */
export function canvasChatLinkHandlers(
  defaults: PreviewTerminalLinkHandler
): PreviewTerminalLinkHandler {
  return {
    ...defaults,
    activate: (event, uri) => {
      // Left button only; Alt is xterm's column selection, Shift extends a selection.
      if (event.button !== 0 || event.altKey || event.shiftKey) {
        return
      }
      event.preventDefault()
      void window.api.shell.openUrl(uri).catch(() => undefined)
    }
  }
}
