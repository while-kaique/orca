import { useEffect, useRef, useState } from 'react'
import { useChatRestoring } from '@/lib/chat-restore-progress'
import { useSecondsWhile } from './use-canvas-chat-peek'

// The flowchart's open chat reads far more history than the dashboard preview's 24 lines.
export const CANVAS_HISTORY_ROWS = 300
export const CANVAS_GRID_CLAIMS = 20
const RESTORE_RETRY_MS = 1500
const RESTORE_GIVE_UP_SECONDS = 120

/**
 * After a restart a chat's saved terminal id is only a hint. The preview says when no terminal exists behind it;
 * then this wakes just that chat once and reconnects until it is back, while the card shows "Restaurando o chat…".
 */
export function useCanvasChatTerminalWake(args: {
  tabId: string
  livePty: string | null
  onWake: () => void
}): {
  restoreSeconds: number
  gaveUp: boolean
  connectAttempt: number
  onAvailability: (available: boolean) => void
} {
  const { tabId, livePty, onWake } = args
  const restoring = useChatRestoring(tabId)
  const [terminalGone, setTerminalGone] = useState(false)
  const [connectAttempt, setConnectAttempt] = useState(0)
  const restoreSeconds = useSecondsWhile(!livePty || restoring || terminalGone)
  const gaveUp = terminalGone && restoreSeconds >= RESTORE_GIVE_UP_SECONDS
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const wokeRef = useRef(false)
  useEffect(() => {
    setTerminalGone(false)
    setConnectAttempt(0)
    wokeRef.current = false
  }, [livePty])
  useEffect(() => {
    if (!terminalGone || gaveUp) {
      return
    }
    // One wake per opening: repeating it could resume the same session twice.
    if (!wokeRef.current) {
      wokeRef.current = true
      onWakeRef.current()
    }
    const retry = setTimeout(() => setConnectAttempt((n) => n + 1), RESTORE_RETRY_MS)
    return () => clearTimeout(retry)
  }, [terminalGone, gaveUp, connectAttempt])
  return {
    restoreSeconds,
    gaveUp,
    connectAttempt,
    onAvailability: (available) => setTerminalGone(!available)
  }
}
