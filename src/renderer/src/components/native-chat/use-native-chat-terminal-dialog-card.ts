import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import type { RuntimeTerminalRead } from '../../../../shared/runtime-terminal-contracts'
import type { InteractivePromptCard } from '../../../../shared/native-chat/input/native-chat-interactive-prompt'
import { parseClaudeTerminalDialog } from '../../../../shared/native-chat/input/native-chat-terminal-dialog'

const POLL_MS = 1500

/** Fork: while Claude is blocked on a dialog that carries no question (`Switch model?`), read it off the terminal
 *  screen so the chat can show it with its options. Null once the pane is no longer blocked. */
export function useNativeChatTerminalDialogCard({
  paneKey,
  agent,
  hasCard
}: {
  paneKey: string
  agent: string
  hasCard: boolean
}): InteractivePromptCard {
  const blocked = useAppStore((s) => {
    const state = s.agentStatusByPaneKey[paneKey]?.state
    return state === 'blocked' || state === 'waiting'
  })
  const [card, setCard] = useState<InteractivePromptCard>(null)
  const active = agent === 'claude' && blocked && !hasCard
  useEffect(() => {
    if (!active) {
      setCard(null)
      return
    }
    let cancelled = false
    const read = async (): Promise<void> => {
      try {
        const { terminal } = await callRuntimeRpc<{ terminal: { handle: string } }>(
          { kind: 'local' },
          'terminal.resolvePane',
          { paneKey }
        )
        const result = await callRuntimeRpc<{ terminal: RuntimeTerminalRead }>(
          { kind: 'local' },
          'terminal.read',
          { terminal: terminal.handle, screen: true }
        )
        const approval = parseClaudeTerminalDialog(result.terminal.tail)
        if (!cancelled) {
          setCard((previous) => {
            const next = approval ? ({ kind: 'approval', approval } as const) : null
            return JSON.stringify(previous) === JSON.stringify(next) ? previous : next
          })
        }
      } catch {
        // The terminal may not be resolvable yet; the next poll retries.
      }
    }
    void read()
    const timer = setInterval(() => void read(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [active, paneKey])
  return active ? card : null
}
