// Fork (o-051): a confirmed close by X first asks the window to suspend every Claude chat, then lets the close go on.
import type { BrowserWindow } from 'electron'
import {
  FORK_SUSPEND_ALL_DEADLINE_MS,
  FORK_SUSPEND_ALL_WINDOW_KEY
} from '../../shared/fork-suspender-todos'

// The window gives up at the deadline and saves; this margin only covers a window that is frozen and never answers.
const FROZEN_WINDOW_MARGIN_MS = 5_000

type SuspendAllReport = { suspended: number; notSuspended: number; timedOut: boolean }

/** Null when the window is gone, frozen or has no batch installed: the sweep at quit then takes every chat. */
export async function askWindowToSuspendAllChats(
  window: BrowserWindow
): Promise<SuspendAllReport | null> {
  if (window.isDestroyed()) {
    return null
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const frozen = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), FORK_SUSPEND_ALL_DEADLINE_MS + FROZEN_WINDOW_MARGIN_MS)
    timer.unref?.()
  })
  const call = window.webContents
    .executeJavaScript(
      `window.${FORK_SUSPEND_ALL_WINDOW_KEY}?.(${FORK_SUSPEND_ALL_DEADLINE_MS}) ?? null`
    )
    .then((report) => report as SuspendAllReport | null)
    .catch(() => null)
  try {
    return await Promise.race([call, frozen])
  } finally {
    clearTimeout(timer)
  }
}

/** The steps after the user answered: suspend all, record who was cut, let the close go (the quit sweep ends what is left). */
export async function closeSuspendingAllChats(steps: {
  suspendAll: () => Promise<unknown>
  recordCut: () => Promise<unknown>
  proceed: () => void
  mark?: (step: string) => void
}): Promise<void> {
  steps.mark?.('suspender-inicio')
  try {
    await steps.suspendAll()
  } catch {
    // A failed batch leaves every chat to the sweep at quit; the close must still go on.
  }
  steps.mark?.('suspender-fim')
  await steps.recordCut()
  steps.proceed()
}
