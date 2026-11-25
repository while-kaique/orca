import type { ChatApproval } from './native-chat-interactive-prompt'

const FOOTER = /Enter to (?:confirm|select)|Esc to cancel/
const OPTION = /^\s*(❯\s*)?\d+\.\s+(\S.*?)\s*$/u
const RULE = /^[\s─━═—-]{8,}$/u
const ESC = String.fromCharCode(27)
const DOWN = `${ESC}[B`
const UP = `${ESC}[A`
const MAX_CONTEXT_LINES = 6

/** Fork: Claude draws some dialogs (`Switch model?`) only in the terminal, with no hook payload; read one off the screen. */
export function parseClaudeTerminalDialog(screen: readonly string[]): ChatApproval | null {
  const lines = screen.map((line) => line.trimEnd())
  const footer = lines.findLastIndex((line) => FOOTER.test(line))
  if (footer === -1) {
    return null
  }
  let cursor = footer - 1
  while (cursor >= 0 && (lines[cursor] ?? '').trim() === '') {
    cursor -= 1
  }
  const options: { label: string; cursored: boolean }[] = []
  while (cursor >= 0) {
    const match = OPTION.exec(lines[cursor] ?? '')
    if (!match) {
      break
    }
    options.unshift({ label: match[2]!, cursored: Boolean(match[1]) })
    cursor -= 1
  }
  if (options.length < 2) {
    return null
  }
  const above: string[] = []
  for (let index = cursor; index >= 0 && above.length < MAX_CONTEXT_LINES; index -= 1) {
    const line = lines[index] ?? ''
    if (RULE.test(line)) {
      break
    }
    above.unshift(line.trim())
  }
  const [title, ...rest] = above.filter((line) => line !== '')
  if (!title) {
    return null
  }
  const from = Math.max(
    0,
    options.findIndex((option) => option.cursored)
  )
  return {
    title,
    ...(rest.length > 0 ? { description: rest.join('\n') } : {}),
    options: options.map((option, index) => ({
      label: option.label,
      send: `${(index >= from ? DOWN : UP).repeat(Math.abs(index - from))}\r`
    }))
  }
}
