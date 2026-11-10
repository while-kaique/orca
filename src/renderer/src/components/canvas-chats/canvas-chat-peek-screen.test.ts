import { expect, it } from 'vitest'
import { readPeekScreen } from './canvas-chat-peek-screen'

const RED_BG = '\x1b[41m'
const RESET = '\x1b[0m'
const COLS = 60
const diffRow = (text: string): string => `${RED_BG}${text.padEnd(COLS)}${RESET}\r\n`

it('keeps padded diff rows as separate lines without their colored padding', async () => {
  const data = [
    `${'x'.repeat(COLS - 2)}

`,
    diffRow('      36 -  paneKey: string | null'),
    diffRow('      37 -  ptyId: string | null')
  ].join('')
  const lines = await readPeekScreen({ cols: COLS, rows: 10, data } as never, { red: '#cd3131' })
  const texts = lines.map((line) => line.map((span) => span.text).join('')).filter(Boolean)
  expect(texts).toEqual([
    'x'.repeat(COLS - 2),
    '      36 -  paneKey: string | null',
    '      37 -  ptyId: string | null'
  ])
})
