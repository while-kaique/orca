import { resolveNativeChatTranscriptAgent } from './native-chat-agent-support'

export type NativeChatTabViewMode = 'terminal' | 'chat'

/** A saved choice for the tab always wins; with none, a Claude tab that can show chat opens in chat. */
export function resolveDefaultNativeChatViewMode(input: {
  savedViewMode: NativeChatTabViewMode | null | undefined
  agent: string | null | undefined
  chatAvailable: boolean
}): NativeChatTabViewMode {
  if (input.savedViewMode) {
    return input.savedViewMode
  }
  return input.chatAvailable && resolveNativeChatTranscriptAgent(input.agent) === 'claude'
    ? 'chat'
    : 'terminal'
}
