import { describe, expect, it } from 'vitest'
import { parseClaudeTerminalDialog } from './native-chat-terminal-dialog'

// Screen captured from Claude Code 2.1.331 after `/model sonnet` mid-turn.
const SWITCH_MODEL_SCREEN = [
  '* Brewed for 37s · done 9:40 AM',
  'Background update waiting while this panel is open',
  '────────────────────────────────────────────────────────────',
  '',
  '  Switch model?',
  '  Your next response will be slower and use more tokens',
  '',
  '  This conversation is cached for the current model. Switching to Sonnet 5.5 means the full history gets re-read.',
  '',
  '  ❯ 1. Yes, switch to Sonnet 5.5',
  '    2. No, go back',
  '',
  '  Enter to confirm · Esc to cancel'
]

describe('parseClaudeTerminalDialog', () => {
  it('reads the model-switch dialog with a key sequence per option', () => {
    expect(parseClaudeTerminalDialog(SWITCH_MODEL_SCREEN)).toEqual({
      title: 'Switch model?',
      description:
        'Your next response will be slower and use more tokens\nThis conversation is cached for the current model. Switching to Sonnet 5.5 means the full history gets re-read.',
      options: [
        { label: 'Yes, switch to Sonnet 5.5', send: '\r' },
        { label: 'No, go back', send: '\u001b[B\r' }
      ]
    })
  })

  it('ignores a screen with no dialog', () => {
    expect(parseClaudeTerminalDialog(['> hello', '  1. not a dialog'])).toBeNull()
  })
})
