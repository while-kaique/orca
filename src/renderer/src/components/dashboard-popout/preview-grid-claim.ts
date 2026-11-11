import type { Terminal } from '@xterm/xterm'
import { clampTerminalViewport } from '../../../../shared/terminal/viewport/terminal-viewport'
import { terminalPreviewApiFor } from './terminal-preview-api'

const FIT_REQUEST_DEBOUNCE_MS = 200
const CLAIM_RETRY_MS = 1500
const GRID_SETTLE_MS = 600
/** Claim the dialog-sized PTY grid once per target size; unchanged requests must not fight a host or phone reclaiming geometry. */
export function createPreviewGridClaim(args: {
  ptyId: string
  container: HTMLElement
  getTerminal: () => Terminal | null
  /** Fork: how many times one target size is requested while the host has not applied it (default once). */
  maxClaimsPerSize?: number
  /** Fork: the host applied the size but this terminal still shows another grid, so it needs a fresh snapshot. */
  onGridOutOfSync?: () => void
}): { schedule: () => void; dispose: () => void } {
  const maxClaimsPerSize = args.maxClaimsPerSize ?? 1
  let claimsForSize = 0
  let lastRequestedFit: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const request = (): void => {
    const terminal = args.getTerminal()
    if (disposed || !terminal) {
      return
    }
    const screen = args.container.querySelector<HTMLElement>('.xterm-screen')
    const box = args.container.parentElement
    if (!screen || !box) {
      return
    }
    // offsetWidth/Height are layout dims, unaffected by the scale transform.
    const cellWidth = screen.offsetWidth / Math.max(1, terminal.cols)
    const cellHeight = screen.offsetHeight / Math.max(1, terminal.rows)
    if (
      !Number.isFinite(cellWidth) ||
      !Number.isFinite(cellHeight) ||
      cellWidth <= 0 ||
      cellHeight <= 0 ||
      box.clientWidth <= 0 ||
      box.clientHeight <= 0
    ) {
      return
    }
    const { cols, rows } = clampTerminalViewport(
      Math.floor(box.clientWidth / cellWidth),
      Math.floor(box.clientHeight / cellHeight)
    )
    const fitKey = `${cols}x${rows}`
    if (fitKey === lastRequestedFit) {
      if (claimsForSize >= maxClaimsPerSize || (terminal.cols === cols && terminal.rows === rows)) {
        return
      }
    } else {
      claimsForSize = 0
    }
    claimsForSize++
    lastRequestedFit = fitKey
    // Successful claims trigger resync with the new grid; rejected claims keep the scaled fallback correct.
    void terminalPreviewApiFor(args.ptyId)
      .fit(args.ptyId, cols, rows)
      .catch(() => null)
      .then((applied) => {
        if (disposed) {
          return
        }
        if (applied?.cols === cols && applied.rows === rows) {
          // The host normally resyncs on its own; only a grid still wrong afterwards needs a manual refresh.
          if (args.onGridOutOfSync) {
            syncTimer = setTimeout(() => {
              const current = args.getTerminal()
              if (!disposed && current && (current.cols !== cols || current.rows !== rows)) {
                args.onGridOutOfSync?.()
              }
            }, GRID_SETTLE_MS)
          }
          return
        }
        // A chat still waking up refuses the claim; ask again until it takes (bounded by maxClaimsPerSize).
        if (
          !disposed &&
          maxClaimsPerSize > 1 &&
          (applied?.cols !== cols || applied.rows !== rows)
        ) {
          timer = setTimeout(() => {
            timer = null
            request()
          }, CLAIM_RETRY_MS)
        }
      })
  }

  const schedule = (): void => {
    if (disposed) {
      return
    }
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      request()
    }, FIT_REQUEST_DEBOUNCE_MS)
  }

  return {
    schedule,
    dispose: (): void => {
      disposed = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (syncTimer) {
        clearTimeout(syncTimer)
        syncTimer = null
      }
    }
  }
}
