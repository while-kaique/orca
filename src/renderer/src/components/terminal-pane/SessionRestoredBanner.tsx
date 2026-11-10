import { useEffect, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import { setChatRestoring, terminalShowsAgentInputBox } from '@/lib/chat-restore-progress'
import type { SessionRestoredBannerReason } from './session-restored-banner-pane-state'

export const SESSION_RESTORED_BANNER_TEXT = '--- session restored ---'
export const SESSION_RESUME_UNAVAILABLE_BANNER_TEXT =
  '--- previous session unavailable, started fresh ---'

type SessionRestoredBannerProps = {
  visible: boolean
  reason?: SessionRestoredBannerReason
  /** Fork: with the pane's terminal, show a loading notice until the resumed agent draws its screen. */
  terminal?: Terminal
  tabId?: string
}

// No input box (other agents, plain shells): give up waiting once output went quiet, or at the cap.
const QUIET_FALLBACK_MS = 20_000
const QUIET_MS = 3000
const LOADING_CAP_MS = 120_000

function useAgentRestoreLoading(terminal: Terminal | undefined, tabId: string | undefined): number {
  const [elapsed, setElapsed] = useState(terminal ? 0 : -1)
  useEffect(() => {
    if (!terminal) {
      return
    }
    const startedAt = Date.now()
    let lastOutputAt = 0
    let done = false
    const finish = (): void => {
      done = true
      setElapsed(-1)
      if (tabId) {
        setChatRestoring(tabId, false)
      }
    }
    if (terminalShowsAgentInputBox(terminal)) {
      finish()
      return
    }
    if (tabId) {
      setChatRestoring(tabId, true)
    }
    const output = terminal.onWriteParsed(() => {
      lastOutputAt = Date.now()
    })
    const tick = setInterval(() => {
      const now = Date.now()
      const quiet = lastOutputAt > 0 && now - lastOutputAt > QUIET_MS
      if (
        terminalShowsAgentInputBox(terminal) ||
        (now - startedAt > QUIET_FALLBACK_MS && quiet) ||
        now - startedAt > LOADING_CAP_MS
      ) {
        finish()
        clearInterval(tick)
        return
      }
      setElapsed(Math.floor((now - startedAt) / 1000))
    }, 500)
    return () => {
      output.dispose()
      clearInterval(tick)
      if (!done && tabId) {
        setChatRestoring(tabId, false)
      }
    }
  }, [terminal, tabId])
  return elapsed
}

export function SessionRestoredBanner({
  visible,
  reason = 'restored',
  terminal,
  tabId
}: SessionRestoredBannerProps): React.JSX.Element | null {
  const elapsed = useAgentRestoreLoading(
    visible && reason === 'restored' ? terminal : undefined,
    tabId
  )
  if (!visible) {
    return null
  }

  return (
    <>
      <div className="session-restored-banner">
        {reason === 'resume-unavailable'
          ? SESSION_RESUME_UNAVAILABLE_BANNER_TEXT
          : SESSION_RESTORED_BANNER_TEXT}
      </div>
      {elapsed >= 0 ? <ChatRestoreLoading seconds={elapsed} /> : null}
    </>
  )
}

/** Centered "restoring" notice with a live seconds counter, so a slow resume never looks frozen. */
export function ChatRestoreLoading({ seconds }: { seconds: number }): React.JSX.Element {
  return (
    <div className="chat-restore-loading" role="status">
      <span className="chat-restore-loading-spin" />
      <b>Restaurando o chat…</b>
      <small>
        {seconds} s{seconds >= 30 ? ' · chats longos demoram mais para voltar' : ''}
      </small>
    </div>
  )
}
