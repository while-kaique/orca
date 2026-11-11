import type { Terminal } from '@xterm/xterm'
import { PaneReparentFrameTracker } from '@/lib/pane-manager/pane-reparent-frame-tracker'

type PreviewBoxFitTerminal = Pick<Terminal, 'rows' | 'buffer'>

/** Replay at real PTY dimensions to avoid ANSI rewrap corruption; scale oversized frames and anchor the end containing the cursor. */
export function createPreviewBoxFit(args: {
  container: HTMLElement
  getTerminal: () => PreviewBoxFitTerminal | null
}): {
  fit: () => void
  schedule: () => void
  scheduleAfterWrite: () => void
  dispose: () => void
} {
  let disposed = false
  const frames = new PaneReparentFrameTracker(() => disposed)
  // Orca enxuto: geometry from the last full fit. Writes only move the cursor, so they re-anchor
  // from this cache instead of forcing a whole-document layout on every streamed chunk.
  let measured: { scale: number; cellHeight: number; boxHeight: number; rows: number } | null = null
  let anchoredTop: boolean | null = null
  const applyAnchor = (box: HTMLElement, anchorTop: boolean): void => {
    if (anchoredTop === anchorTop) {
      return
    }
    anchoredTop = anchorTop
    box.style.alignItems = anchorTop ? 'flex-start' : 'flex-end'
    args.container.style.transformOrigin = anchorTop ? 'top left' : 'bottom left'
  }
  const fit = (): void => {
    const terminal = args.getTerminal()
    const screen = args.container.querySelector<HTMLElement>('.xterm-screen')
    const box = args.container.parentElement
    if (!screen || !box || !terminal) {
      measured = null
      return
    }
    const scale = Math.min(1, box.clientWidth / Math.max(1, screen.offsetWidth))
    args.container.style.transform = scale < 1 ? `scale(${scale})` : ''
    const rows = Math.max(1, terminal.rows)
    const cellHeight = screen.offsetHeight / rows
    const boxHeight = box.clientHeight
    measured = { scale, cellHeight, boxHeight, rows: terminal.rows }
    anchoredTop = null
    const cursorBottom = (terminal.buffer.active.cursorY + 1) * cellHeight * scale
    applyAnchor(box, cursorBottom <= boxHeight)
  }
  const reanchor = (): void => {
    const terminal = args.getTerminal()
    const box = args.container.parentElement
    if (!measured || !terminal || !box || terminal.rows !== measured.rows) {
      fit()
      return
    }
    const cursorBottom = (terminal.buffer.active.cursorY + 1) * measured.cellHeight * measured.scale
    applyAnchor(box, cursorBottom <= measured.boxHeight)
  }

  // rAF coalesces; a pending full fit wins over a cursor-only re-anchor.
  let scheduled: 'full' | 'cursor' | null = null
  const request = (kind: 'full' | 'cursor'): void => {
    if (disposed) {
      return
    }
    if (scheduled) {
      if (kind === 'full') {
        scheduled = 'full'
      }
      return
    }
    scheduled = kind
    frames.request(() => {
      const run = scheduled === 'full' ? fit : reanchor
      scheduled = null
      run()
    })
  }

  return {
    fit,
    // Size changes (box resize, snapshot replace): full measurement.
    schedule: (): void => request('full'),
    // After a parsed write the cursor may move ends; the grid size did not change.
    scheduleAfterWrite: (): void => request('cursor'),
    dispose: (): void => {
      if (disposed) {
        return
      }
      disposed = true
      frames.cancelPending()
    }
  }
}
