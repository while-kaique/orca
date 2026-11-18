/** Transcript path → model the chat runs now. */
export type CanvasChatModels = Record<string, string>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const MODEL_SWITCH = /Set model to `([^`]+?)(?:\s*\([^)]*\))?`/u

/**
 * Claude's status record carries no model, but its transcript does: every main-thread reply names the
 * model that wrote it, a `/model` typed in the terminal leaves a "Set model to" line right away, and
 * every request names its model as it is sent (the only trace of a switch made on the chat screen).
 */
export function modelFromTranscriptTail(tail: string): string | null {
  const lines = tail.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.startsWith('{')) {
      continue
    }
    const isReply = line.includes('"model"')
    const isSwitch = line.includes('Set model to')
    if (!isReply && !isSwitch) {
      continue
    }
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      // The tail starts mid-line, or the transcript was caught mid-write.
      continue
    }
    if (isRecord(entry) && entry.type === 'api-request') {
      const requested = isRecord(entry.params) ? entry.params.model : undefined
      if (
        entry.querySource === 'repl_main_thread' &&
        typeof requested === 'string' &&
        !requested.startsWith('<')
      ) {
        return requested
      }
      continue
    }
    if (!isRecord(entry) || entry.isSidechain === true || !isRecord(entry.message)) {
      continue
    }
    const { model, content } = entry.message
    if (entry.type === 'assistant' && typeof model === 'string' && !model.startsWith('<')) {
      return model
    }
    const switched =
      entry.type === 'user' &&
      typeof content === 'string' &&
      content.startsWith('<local-command-stdout>')
        ? MODEL_SWITCH.exec(content)
        : null
    if (switched) {
      return switched[1]
    }
  }
  return null
}
