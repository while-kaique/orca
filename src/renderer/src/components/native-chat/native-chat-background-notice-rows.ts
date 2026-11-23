import { translate } from '@/i18n/i18n'
import { CLAUDE_TASK_NOTIFICATION_MARKER } from '../../../../shared/claude-task-notification-text'
import {
  isTextBlock,
  type NativeChatMessage
} from '../../../../shared/native-chat/native-chat-types'

const SUMMARY = /<summary>([\s\S]*?)<\/summary>/
const QUOTED_NAME = /"([^"]+)"/

function noticeLabel(text: string): string {
  const summary = SUMMARY.exec(text)?.[1]?.trim() ?? ''
  const name = QUOTED_NAME.exec(summary)?.[1]?.trim()
  const what = name || summary
  return what
    ? translate('fork.native.backgroundNotice', 'Aviso de segundo plano: {{what}}', { what })
    : translate('fork.native.backgroundNoticeBare', 'Aviso de uma tarefa em segundo plano')
}

/** Fork: Claude answers a background-task notice in a new turn. Dropping the notice merged that turn into the
 *  previous prompt and hid the reply to it, so the notice stays as a faint row that opens its own turn. */
export function nativeChatBackgroundNoticeRows(messages: NativeChatMessage[]): NativeChatMessage[] {
  let changed = false
  const rows = messages.map((message) => {
    if (message.role !== 'user' || message.backgroundNotice) {
      return message
    }
    const text = message.blocks.find(isTextBlock)?.text.trimStart() ?? ''
    if (!text.startsWith(CLAUDE_TASK_NOTIFICATION_MARKER)) {
      return message
    }
    changed = true
    return {
      ...message,
      blocks: [{ type: 'text' as const, text: noticeLabel(text) }],
      backgroundNotice: true as const
    }
  })
  return changed ? rows : messages
}
