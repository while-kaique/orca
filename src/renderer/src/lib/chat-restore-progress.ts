import { useSyncExternalStore } from 'react'
import type { Terminal } from '@xterm/xterm'

// Fork: chats whose agent is being resumed and has not drawn its screen yet, shared by the pane and the flowchart.
const restoringTabs = new Set<string>()
const listeners = new Set<() => void>()

export function setChatRestoring(tabId: string, restoring: boolean): void {
  if (restoringTabs.has(tabId) === restoring) {
    return
  }
  if (restoring) {
    restoringTabs.add(tabId)
  } else {
    restoringTabs.delete(tabId)
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export function useChatRestoring(tabId: string): boolean {
  return useSyncExternalStore(subscribe, () => restoringTabs.has(tabId))
}

const RULE_LINE = /─{10,}/u

/** Claude's input box (two long rules) on screen means the resumed chat is drawn and usable. */
export function terminalShowsAgentInputBox(terminal: Terminal): boolean {
  const buffer = terminal.buffer.active
  let rules = 0
  for (let y = buffer.viewportY; y < buffer.viewportY + terminal.rows; y++) {
    if (RULE_LINE.test(buffer.getLine(y)?.translateToString(true) ?? '')) {
      rules++
    }
  }
  return rules >= 2
}
