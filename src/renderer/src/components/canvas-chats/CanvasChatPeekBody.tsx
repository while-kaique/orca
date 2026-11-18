import { translate } from '@/i18n/i18n'
import { renderCanvasMarkdown } from './canvas-chats-markdown'
import { peekMessages } from './canvas-chat-peek-messages'

/** The hover peek of a closed card: the user's last message, then Claude's last reply, formatted like the chat screen. */
export function CanvasChatPeekBody({
  prompt,
  reply,
  asleep
}: {
  prompt: string | undefined
  reply: string
  asleep: boolean
}): React.JSX.Element {
  const messages = peekMessages(prompt, reply)
  return (
    <div className="cc-peek-body">
      {messages.prompt ? <div className="cc-peek-prompt">› {messages.prompt}</div> : null}
      {messages.reply ? (
        <div className="cc-peek-reply">{renderCanvasMarkdown(messages.reply)}</div>
      ) : null}
      {!messages.prompt && !messages.reply ? (
        <div className="cc-line-empty">
          {asleep
            ? translate(
                'fork.canvas.peekAsleep',
                'Chat dormindo desde que o Orca reabriu. Clique para acordar.'
              )
            : translate('fork.canvas.noText', 'sem mensagens ainda')}
        </div>
      ) : null}
    </div>
  )
}
