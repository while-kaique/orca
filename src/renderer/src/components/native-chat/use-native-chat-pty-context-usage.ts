import { useEffect, useMemo, useState } from 'react'
import type { StructuredAgentContextUsage } from '../../../../shared/agent-session/structured-agent-session-context-usage'
import { CANVAS_CONTEXT_LIMIT_TOKENS } from '../../../../shared/canvas-context-tokens'

/**
 * Fork: a terminal-backed chat has no structured journal, so the ring's numbers come from the
 * transcript's last reply (the same count the flowchart cards show). `refreshKey` changes when
 * the chat gets a new reply or changes state, so the ring follows the conversation.
 */
export function usePtyContextUsage(
  transcriptPath: string | null | undefined,
  refreshKey: unknown,
  enabled: boolean
): StructuredAgentContextUsage | null {
  const [tokens, setTokens] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled || !transcriptPath) {
      setTokens(null)
      return
    }
    let alive = true
    void window.api.repos
      .readCanvasContextTokens([transcriptPath])
      .then((next) => {
        if (alive) {
          setTokens(next[transcriptPath] ?? null)
        }
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [enabled, transcriptPath, refreshKey])
  return useMemo(
    () =>
      tokens === null
        ? null
        : {
            usedTokens: tokens,
            windowTokens: CANVAS_CONTEXT_LIMIT_TOKENS,
            percentage: Math.round((tokens / CANVAS_CONTEXT_LIMIT_TOKENS) * 100),
            estimated: true,
            categories: []
          },
    [tokens]
  )
}
