import {
  isTextBlock,
  type NativeChatMessage
} from '../../../../shared/native-chat/native-chat-types'

/** Claude Code's own bash-mode pink, so a `!` command reads the same in the chat and in the terminal. */
export const NATIVE_CHAT_BASH_PINK = 'rgb(253, 93, 177)'

const BASH_INPUT = /^\s*<bash-input>([\s\S]*?)<\/bash-input>\s*$/
const BASH_STDOUT = /<bash-stdout>([\s\S]*?)<\/bash-stdout>/
const BASH_STDERR = /<bash-stderr>([\s\S]*?)<\/bash-stderr>/

/** Fork: Claude stores a `!` command and its result as tagged user rows that the chat dropped as harness noise;
 *  show the command as the user typed it and the result as command output, as the terminal does. */
export function nativeChatBashRows(messages: NativeChatMessage[]): NativeChatMessage[] {
  let changed = false
  const rows = messages.map((message) => {
    if (message.role !== 'user' || message.bashCommand) {
      return message
    }
    const text = message.blocks
      .filter(isTextBlock)
      .map((block) => block.text)
      .join('')
    const input = BASH_INPUT.exec(text)
    if (input) {
      changed = true
      return {
        ...message,
        blocks: [{ type: 'text' as const, text: `!${input[1]!.trim()}` }],
        bashCommand: true as const
      }
    }
    const stdout = BASH_STDOUT.exec(text)
    const stderr = BASH_STDERR.exec(text)
    if (!text.trimStart().startsWith('<bash-std') || (!stdout && !stderr)) {
      return message
    }
    changed = true
    const output = [stdout?.[1], stderr?.[1]]
      .map((part) => part?.replace(/\r\n/g, '\n').trimEnd() ?? '')
      .filter(Boolean)
      .join('\n')
    return {
      ...message,
      role: 'system' as const,
      bashCommand: true as const,
      blocks: [
        {
          type: 'text' as const,
          text: output || '(sem saída)',
          presentation: 'command-output'
        }
      ]
    }
  })
  return changed ? rows : messages
}
