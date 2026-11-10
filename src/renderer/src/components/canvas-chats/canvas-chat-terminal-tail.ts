import { useEffect, useState } from 'react'
import { terminalPreviewApiFor } from '../dashboard-popout/terminal-preview-api'
import type { ITheme } from '@xterm/xterm'
import { noteCanvasChatArtifacts } from './canvas-chat-artifacts'
import { readPeekScreen, type PeekLine } from './canvas-chat-peek-screen'

/** Drops terminal escape codes (colors, cursor moves, window titles) so only the text remains. */
function stripTerminalCodes(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    if (code !== 27) {
      out += raw[i]
      continue
    }
    const next = raw[i + 1]
    if (next === '[') {
      const start = i + 2
      i = start
      while (i < raw.length && (raw.charCodeAt(i) < 64 || raw.charCodeAt(i) > 126)) {
        i++
      }
      // TUIs move the cursor right instead of printing spaces; keep those gaps as real spaces.
      if (raw[i] === 'C') {
        out += ' '.repeat(Math.min(200, Number.parseInt(raw.slice(start, i), 10) || 1))
      }
    } else if (next === ']') {
      i += 2
      while (i < raw.length && raw.charCodeAt(i) !== 7 && raw.charCodeAt(i) !== 27) {
        i++
      }
      if (raw.charCodeAt(i) === 27) {
        i++
      }
    } else {
      i++
    }
  }
  return out
}

const FRAME_ONLY = /^[\s─━│┃╭╮╰╯┌┐└┘├┤┬┴┼═║>›?•·]*$/u
const RULE_LINE = /─{10,}/u
const AGENT_UI_LINE =
  /esc to interrupt|shift\+tab to cycle|\? for shortcuts|bypass permissions|auto mode on|\d+(\.\d+)?k context|^[✻✶✢✳·*]\s*\w+ for \d|^[⎿└L]\s|^●?\s*(Read|Write|Edit|Bash|Grep|Glob|Update)\(|\(\d+ lines?\)|Compacted while idle|background (shell|tasks?)|Task ?ids?:|Tip:|ctrl\+o to expand|disable recaps|[▐▛▜▌▝▘▙▟█]|Claude Code v\d|^~[\\/]|new task\?\s*\/clear|※\s*recap:/iu

/** Conversation only: Claude's input box sits between the last two rules, with the status line below it. */
function conversationRows(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[│┃\r]/g, '').trimEnd())
  const rules = lines.flatMap((line, i) => (RULE_LINE.test(line) ? [i] : []))
  const end = rules.at(-2) ?? rules.at(-1) ?? lines.length
  return lines.slice(0, end).filter((line) => line.trim().length > 1 && !FRAME_ONLY.test(line))
}

export type CanvasTerminalTail = { clean: string[]; peek: PeekLine[] }

const EMPTY_TAIL: CanvasTerminalTail = { clean: [], peek: [] }

// Card reads run two at a time so opening the flowchart doesn't serialize every chat's terminal at once.
const MAX_PARALLEL_READS = 2
let activeReads = 0
const waitingReads: (() => void)[] = []

function withReadSlot<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<void>((resolve) => {
    if (activeReads < MAX_PARALLEL_READS) {
      activeReads++
      resolve()
    } else {
      waitingReads.push(resolve)
    }
  })
    .then(run)
    .finally(() => {
      const next = waitingReads.shift()
      if (next) {
        next()
      } else {
        activeReads--
      }
    })
}

// The first read of a terminal scans deep for old artifact links/ports (they are saved); later reads only need the end.
const deeplyScanned = new Set<string>()
const DEEP_SCAN_ROWS = 2000
const RECENT_ROWS = 300

/**
 * Last readable lines of the chat's terminal: `clean` (prose only, for the card text) and
 * `peek` (the last 7 lines styled like the terminal, for hover). `live` re-reads every second.
 */
export function useTerminalTail(
  ptyId: string | null,
  refreshKey: string,
  tabId: string,
  live: boolean,
  theme: ITheme | null
): CanvasTerminalTail {
  const [tail, setTail] = useState<CanvasTerminalTail>(EMPTY_TAIL)
  useEffect(() => {
    if (!ptyId) {
      return
    }
    let alive = true
    // Only undo a connect that happened: a skipped read must not cut the open card's live terminal.
    let connected = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const api = terminalPreviewApiFor(ptyId)
    const connect = (): ReturnType<typeof api.connect> => {
      const deep = !live && !deeplyScanned.has(ptyId)
      return api
        .connect(ptyId, { scrollbackRows: deep ? DEEP_SCAN_ROWS : RECENT_ROWS })
        .then((result) => {
          connected = true
          if (deep) {
            deeplyScanned.add(ptyId)
          }
          return result
        })
    }
    const read = (): void => {
      // Hover reads skip the queue: they are one card, and the user is looking at it.
      void (live ? connect() : withReadSlot(() => (alive ? connect() : Promise.reject())))
        .then(async (result) => {
          const raw = `${result.snapshot?.scrollbackAnsi ?? ''}\n${result.snapshot?.data ?? ''}`
          noteCanvasChatArtifacts(tabId, raw)
          const clean = conversationRows(stripTerminalCodes(raw))
            .map((line) => line.trim())
            .filter((line) => !AGENT_UI_LINE.test(line))
            .slice(-6)
          const peek = live && result.snapshot ? await readPeekScreen(result.snapshot, theme) : []
          if (alive) {
            setTail({ clean, peek })
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (connected) {
            connected = false
            void api.unsubscribe(ptyId).catch(() => undefined)
          }
          if (alive && live) {
            timer = setTimeout(read, 1000)
          }
        })
    }
    read()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [ptyId, refreshKey, tabId, live, theme])
  return tail
}
