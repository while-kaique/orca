import type { BrowserWindow } from 'electron'
import type { Store } from '../persistence/loading-store/store'

/**
 * Fork (PC-desk): Windows shutdown/logoff kills the app without before-quit or beforeunload,
 * so the debounced session write (up to 5 s) was lost. Start the write as soon as Windows asks.
 * Best effort since 1.4.249: the live store writes on a worker, so flush() only starts it; the
 * query-session-end head start is what lets it land. Never flushAsync() here: it is the final
 * flush and would block later writes if the shutdown is cancelled.
 */
export function installOsSessionEndFlush(window: BrowserWindow, store: Store): void {
  if (process.platform !== 'win32') {
    return
  }
  const flush = (): void => {
    try {
      store.flush()
    } catch {
      // Best effort: the OS is tearing the session down either way.
    }
  }
  window.on('query-session-end', flush)
  window.on('session-end', flush)
}
