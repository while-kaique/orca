import { useMemo } from 'react'
import { usePtyContextUsage } from './use-native-chat-pty-context-usage'
import type {
  NativeChatComposerProps,
  NativeChatStructuredComposerTransport
} from './native-chat-composer-types'
import {
  summarizeContextUsage,
  type NativeChatContextUsageSummary
} from './native-chat-context-usage-summary'

/** The ring's input. A terminal-backed chat has no structured journal; the fork feeds it from the transcript. */
export function useNativeChatContextUsageSummary(
  structuredTransport: NativeChatStructuredComposerTransport | undefined,
  ptyContext?: NativeChatComposerProps['ptyContext']
): NativeChatContextUsageSummary | null {
  const ptyUsage = usePtyContextUsage(
    ptyContext?.transcriptPath,
    ptyContext?.refreshKey,
    !structuredTransport
  )
  const usage = structuredTransport ? (structuredTransport.contextUsage ?? null) : ptyUsage
  return useMemo(() => (usage ? summarizeContextUsage(usage) : null), [usage])
}
