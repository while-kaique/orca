import { useMemo } from 'react'
import { Terminal, type IBufferCell, type ITheme } from '@xterm/xterm'
import { composeActiveTerminalTheme } from '@/components/terminal-pane/terminal-appearance'
import { useSystemPrefersDark } from '@/components/terminal-pane/use-system-prefers-dark'
import { resolveEffectiveTerminalAppearance } from '@/lib/terminal-theme'
import { useAppStore } from '@/store'
import type { TerminalPreviewSnapshot } from '../../../../shared/terminal/replay/terminal-preview'

export type PeekSpan = {
  text: string
  color?: string
  background?: string
  bold?: boolean
  italic?: boolean
  dim?: boolean
}
export type PeekLine = PeekSpan[]

const PEEK_LINES = 7
const RULE_LINE = /─{10,}/u
const ANSI_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite'
] as const

function paletteColor(index: number, theme: ITheme | null): string | undefined {
  if (index < 16) {
    return theme?.[ANSI_NAMES[index]]
  }
  if (index < 232) {
    const n = index - 16
    const level = (v: number): number => (v === 0 ? 0 : 55 + v * 40)
    return `rgb(${level(Math.floor(n / 36))},${level(Math.floor(n / 6) % 6)},${level(n % 6)})`
  }
  const gray = 8 + (index - 232) * 10
  return `rgb(${gray},${gray},${gray})`
}

function cellColor(
  cell: IBufferCell,
  which: 'fg' | 'bg',
  theme: ITheme | null
): string | undefined {
  const isRgb = which === 'fg' ? cell.isFgRGB() : cell.isBgRGB()
  const isPalette = which === 'fg' ? cell.isFgPalette() : cell.isBgPalette()
  const value = which === 'fg' ? cell.getFgColor() : cell.getBgColor()
  if (isRgb) {
    return `#${value.toString(16).padStart(6, '0')}`
  }
  return isPalette ? paletteColor(value, theme) : undefined
}

function sameStyle(a: PeekSpan, b: Omit<PeekSpan, 'text'>): boolean {
  return (
    a.color === b.color &&
    a.background === b.background &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.dim === b.dim
  )
}

function lineText(line: PeekLine): string {
  return line.map((span) => span.text).join('')
}

function trimEnd(line: PeekLine): PeekLine {
  const out = line.map((span) => ({ ...span }))
  while (out.length > 0) {
    const last = out.at(-1)!
    const trimmed = last.background ? last.text : last.text.trimEnd()
    if (trimmed) {
      last.text = trimmed
      break
    }
    out.pop()
  }
  return out
}

/** Terminal rows joined back into Claude's lines, with colors, so the card can re-wrap them to its own width. */
function logicalLines(terminal: Terminal, theme: ITheme | null): PeekLine[] {
  const buffer = terminal.buffer.active
  const lines: PeekLine[] = []
  const cell = buffer.getNullCell()
  for (let y = 0; y < buffer.length; y++) {
    const row = buffer.getLine(y)
    if (!row) {
      continue
    }
    const line: PeekLine = row.isWrapped && lines.length > 0 ? lines.pop()! : []
    for (let x = 0; x < row.length; x++) {
      if (!row.getCell(x, cell) || cell.getWidth() === 0) {
        continue
      }
      const style = {
        color: cellColor(cell, 'fg', theme),
        background: cellColor(cell, 'bg', theme),
        bold: cell.isBold() !== 0 || undefined,
        italic: cell.isItalic() !== 0 || undefined,
        dim: cell.isDim() !== 0 || undefined
      }
      const text = cell.getChars() || ' '
      const last = line.at(-1)
      if (last && sameStyle(last, style)) {
        last.text += text
      } else {
        line.push({ text, ...style })
      }
    }
    lines.push(line)
  }
  return lines.map(trimEnd)
}

/** The last 7 lines of the conversation (above Claude's input box), styled like the real terminal. */
export function readPeekScreen(
  snapshot: TerminalPreviewSnapshot,
  theme: ITheme | null
): Promise<PeekLine[]> {
  const terminal = new Terminal({
    cols: Math.max(2, Math.min(500, snapshot.cols || 120)),
    rows: Math.max(2, Math.min(200, snapshot.rows || 40)),
    scrollback: 1000,
    allowProposedApi: true
  })
  return new Promise<PeekLine[]>((resolve) => {
    terminal.write(`${snapshot.scrollbackAnsi ?? ''}${snapshot.data}`, () => {
      const lines = logicalLines(terminal, theme)
      terminal.dispose()
      const rules = lines.flatMap((line, i) => (RULE_LINE.test(lineText(line)) ? [i] : []))
      const end = rules.at(-2) ?? rules.at(-1) ?? lines.length
      const conversation = lines.slice(0, end)
      // Count only lines with text; keep the blank lines between them so paragraphs breathe like the terminal.
      let start = conversation.length
      for (let seen = 0; start > 0 && seen < PEEK_LINES; start--) {
        if (lineText(conversation[start - 1]).trim()) {
          seen++
        }
      }
      resolve(conversation.slice(start))
    })
  })
}

/** Same terminal theme the open card's terminal uses. */
export function usePeekTheme(): ITheme | null {
  const settings = useAppStore((state) => state.settings)
  const systemPrefersDark = useSystemPrefersDark()
  return useMemo(() => {
    if (!settings) {
      return null
    }
    const appearance = resolveEffectiveTerminalAppearance(settings, systemPrefersDark)
    return composeActiveTerminalTheme(appearance.theme, settings)
  }, [settings, systemPrefersDark])
}
