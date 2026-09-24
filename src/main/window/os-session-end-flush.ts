import type { BrowserWindow } from 'electron'
import type { Store } from '../persistence'

/**
 * Fork (PC-desk): Windows shutdown/logoff kills the app without before-quit or beforeunload,
 * so the debounced session write (up to 5 s) was lost. Flush it when Windows announces the end.
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
