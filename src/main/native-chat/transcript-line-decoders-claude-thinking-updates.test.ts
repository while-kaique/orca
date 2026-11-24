import { describe, expect, it } from 'vitest'
import { decodeClaudeTranscriptLine } from './transcript-line-decoders-claude'

// Shape captured from Claude Code 2.1.331 on Opus 5.5.
function thinkingRow(thinkingDisplay: string | undefined, thinking: string): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: 'update-row',
    timestamp: '2026-11-24T18:00:10.643Z',
    ...(thinkingDisplay ? { thinkingDisplay } : {}),
    message: {
      role: 'assistant',
      content: [{ type: 'thinking', thinking, signature: 'sig' }]
    }
  })
}

describe('Claude thinking shown as updates', () => {
  it('reads an update to the user as something Claude said', () => {
    const decoded = decodeClaudeTranscriptLine(
      thinkingRow('updates', 'Quase lá: repito o teste sozinho.'),
      'fallback'
    )
    expect(decoded?.role).toBe('assistant')
  })

  it('keeps ordinary thinking as reasoning', () => {
    const decoded = decodeClaudeTranscriptLine(thinkingRow(undefined, 'Let me check.'), 'fallback')
    expect(decoded?.role).toBe('reasoning')
  })
})
