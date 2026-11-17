import { useAppStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import { getConnectionIdFromState } from '@/lib/connection-context'
import { getCachedTerminalTabForWorktree } from '../terminal-pane/terminal-tab-lookup'
import { selectUnifiedTerminalTabFields } from '../terminal-pane/terminal-unified-tab-lookup'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { isNativeChatAgentAvailable } from '../../../../shared/native-chat/native-chat-availability'
import { isNativeChatTranscriptLocalReadable } from '../../../../shared/native-chat/transcript/native-chat-transcript-readability'
import {
  resolveDefaultNativeChatViewMode,
  type NativeChatTabViewMode
} from '../../../../shared/native-chat/native-chat-default-view-mode'

/** The open card shows the chat screen only for a supported agent with a readable conversation; otherwise the terminal. */
export function canvasChatScreenChoice(input: {
  savedViewMode: NativeChatTabViewMode | undefined
  agent: string | null
  transcriptIsLocalReadable: boolean
  hasConversation: boolean
}): { available: boolean; mode: NativeChatTabViewMode } {
  const available =
    input.hasConversation &&
    isNativeChatAgentAvailable(input.agent, input.transcriptIsLocalReadable)
  return {
    available,
    mode: available
      ? resolveDefaultNativeChatViewMode({
          savedViewMode: input.savedViewMode,
          agent: input.agent,
          chatAvailable: true
        })
      : 'terminal'
  }
}

/** Which screen an open card shows, and how the user switches; the choice is the tab's own saved view mode. */
export function useCanvasChatScreenChoice(chat: {
  worktreeId: string
  tabId: string
  paneKey: string | null
}): {
  available: boolean
  mode: NativeChatTabViewMode
  setMode: (mode: NativeChatTabViewMode) => void
  launchAgent: TuiAgent | null
} {
  const { worktreeId, tabId, paneKey } = chat
  const detectedAgent = useAppStore((s) =>
    paneKey ? (s.agentStatusByPaneKey[paneKey]?.agentType ?? null) : null
  )
  const hasConversation = useAppStore((s) => {
    const session = paneKey ? s.agentStatusByPaneKey[paneKey]?.providerSession : undefined
    return Boolean(session?.id || session?.transcriptPath)
  })
  const launchAgent = useAppStore(
    (s) => getCachedTerminalTabForWorktree(s.tabsByWorktree, worktreeId, tabId)?.launchAgent ?? null
  )
  const transcriptIsLocalReadable = useAppStore((s) =>
    isNativeChatTranscriptLocalReadable(getConnectionIdFromState(s, worktreeId))
  )
  const { unifiedTabId, savedViewMode } = useAppStore(
    useShallow((s) => {
      const fields = selectUnifiedTerminalTabFields(s.unifiedTabsByWorktree, worktreeId, tabId)
      return { unifiedTabId: fields.unifiedTabId, savedViewMode: fields.savedViewMode }
    })
  )
  const choice = canvasChatScreenChoice({
    savedViewMode,
    agent: detectedAgent ?? launchAgent,
    transcriptIsLocalReadable,
    hasConversation
  })
  return {
    ...choice,
    launchAgent,
    setMode: (mode) => {
      if (unifiedTabId) {
        useAppStore.getState().setTabViewMode(unifiedTabId, mode)
      }
    }
  }
}
