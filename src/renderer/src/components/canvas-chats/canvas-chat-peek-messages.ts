/** What the hover peek of a closed card shows: the user's last message and Claude's last reply, cut cleanly. */
export const PEEK_PROMPT_CHARS = 180
export const PEEK_REPLY_CHARS = 700
export const PEEK_REPLY_LINES = 14

export type PeekMessages = { prompt: string | null; reply: string | null }

const FENCE = /^\s*```/u

/** Cuts at the end of a sentence when one is in the back half, else at a word, so no lone word is left dangling. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  const head = text.slice(0, max)
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (sentence > max / 2) {
    return head.slice(0, sentence).trimEnd()
  }
  const space = head.lastIndexOf(' ')
  return (space > max / 2 ? head.slice(0, space) : head).trimEnd()
}

/** A cut can leave `**` or a backtick open, which would print as raw marks: drop from the last opener. */
function dropOpenMarks(text: string): string {
  let out = text
  for (const mark of ['**', '`']) {
    const count = out.split(mark).length - 1
    if (count % 2 === 1) {
      out = out.slice(0, out.lastIndexOf(mark)).trimEnd()
    }
  }
  return out
}

export function clipPeekPrompt(prompt: string | undefined): string | null {
  const text = (prompt ?? '').replace(/\s+/gu, ' ').trim()
  if (!text) {
    return null
  }
  return text.length > PEEK_PROMPT_CHARS
    ? `${dropOpenMarks(cutAtWord(text, PEEK_PROMPT_CHARS))}…`
    : text
}

/** Keeps the start of the reply (the answer comes first) and ends with an ellipsis when something was left out. */
export function clipPeekReply(reply: string | undefined): string | null {
  const text = (reply ?? '')
    .replace(/\r/gu, '')
    .split('\n')
    .filter((line) => !FENCE.test(line))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
  if (!text) {
    return null
  }
  const lines = text.split('\n')
  const kept: string[] = []
  let used = 0
  for (const line of lines) {
    const room = PEEK_REPLY_CHARS - used
    if (kept.length >= PEEK_REPLY_LINES || room <= 0) {
      break
    }
    if (line.length + 1 > room) {
      // Only a first line that alone overflows is cut inside the line; later ones are left out whole.
      if (kept.length === 0) {
        kept.push(cutAtWord(line, room))
      }
      break
    }
    kept.push(line)
    used += line.length + 1
  }
  if (kept.length === lines.length && kept.join('\n') === text) {
    return text
  }
  while (kept.length > 1 && kept.at(-1)?.trim() === '') {
    kept.pop()
  }
  const last = kept.pop() ?? ''
  return [...kept, `${dropOpenMarks(last.trimEnd())}…`].join('\n')
}

export function peekMessages(prompt: string | undefined, reply: string | undefined): PeekMessages {
  return { prompt: clipPeekPrompt(prompt), reply: clipPeekReply(reply) }
}
