// Fork: the flowchart shows how full each chat's context is, from 0 to this many tokens.
export const CANVAS_CONTEXT_LIMIT_TOKENS = 1_000_000

/** Transcript path → tokens in the chat's context after its last reply. */
export type CanvasContextTokens = Record<string, number>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function count(usage: Record<string, unknown>, field: string): number {
  const value = usage[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** The last main-thread assistant message carries the usage of that call: what it read plus what it wrote. */
export function contextTokensFromTranscriptTail(tail: string): number | null {
  const lines = tail.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.startsWith('{') || !line.includes('"usage"')) {
      continue
    }
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      // The tail starts mid-line, or the transcript was caught mid-write.
      continue
    }
    // Subagents run in their own context; only the chat's own thread counts.
    if (!isRecord(entry) || entry.isSidechain === true || !isRecord(entry.message)) {
      continue
    }
    const usage = entry.message.usage
    if (!isRecord(usage) || typeof usage.input_tokens !== 'number') {
      continue
    }
    return (
      count(usage, 'input_tokens') +
      count(usage, 'cache_read_input_tokens') +
      count(usage, 'cache_creation_input_tokens') +
      count(usage, 'output_tokens')
    )
  }
  return null
}
