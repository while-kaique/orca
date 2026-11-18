import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { NativeChatPendingSend } from '../../../../shared/native-chat/transcript/native-chat-pending-sends'
import type { NativeChatTurnActivity } from '../../../../shared/native-chat/transcript/native-chat-turn-activity'

/** A send that nothing has confirmed after this long stops reading as "sending". */
export const NATIVE_CHAT_SENDING_MAX_MS = 60_000

type SendingEntry = Pick<NativeChatPendingSend, 'delivery' | 'recovery' | 'sentAt'>

const isSendingEntry = (entry: SendingEntry): boolean => !entry.delivery && !entry.recovery

/**
 * Fork: a message sent from the chat screen is "sending" from the moment it leaves the composer until the turn
 * it starts is active; a rejected, uncertain or recovered send is not. The tail line then reads "Enviando…" instead of staying empty.
 */
export function isNativeChatSending(input: {
  pending: readonly SendingEntry[]
  turnActive: boolean
  now: number
}): boolean {
  return (
    !input.turnActive &&
    input.pending.some(
      (entry) => isSendingEntry(entry) && input.now - entry.sentAt < NATIVE_CHAT_SENDING_MAX_MS
    )
  )
}

/** What the message list gets: working while a turn runs or a send waits for it, with "Enviando…" as the tail line until the turn starts. */
export function useNativeChatSendingTail(
  pending: readonly SendingEntry[],
  turnActive: boolean
): { isWorking: boolean; turnActivity?: NativeChatTurnActivity } {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const current = Date.now()
    setNow(current)
    const deadlines = pending
      .filter(isSendingEntry)
      .map((entry) => entry.sentAt + NATIVE_CHAT_SENDING_MAX_MS)
    if (deadlines.length === 0) {
      return
    }
    const timer = setTimeout(() => setNow(Date.now()), Math.min(...deadlines) - current + 1)
    return () => clearTimeout(timer)
  }, [pending])
  return isNativeChatSending({ pending, turnActive, now })
    ? {
        isWorking: true,
        turnActivity: {
          kind: 'description',
          text: translate('fork.nativeChat.sending', 'Enviando…')
        }
      }
    : { isWorking: turnActive }
}
