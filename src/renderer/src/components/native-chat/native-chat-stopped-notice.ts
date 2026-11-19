import { translate } from '@/i18n/i18n'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'

/** The transcript hides "[Request interrupted]", so a stop leaves this visible line until the next turn. */
export function nativeChatStoppedNoticeMessages(stopped: boolean): NativeChatMessage[] {
  if (!stopped) {
    return []
  }
  return [
    {
      id: 'stopped',
      role: 'system',
      blocks: [
        { type: 'text', text: translate('fork.native.stoppedNotice', 'Resposta cancelada') }
      ],
      timestamp: null,
      source: 'scrape'
    }
  ]
}
