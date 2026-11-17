import { useCallback, useEffect } from 'react'
import { nativeChatAvailabilityAgent } from '../../../../shared/native-chat/native-chat-availability'
import { resolveDefaultNativeChatViewMode } from '../../../../shared/native-chat/native-chat-default-view-mode'
import { nativeChatLaunchAgentForLeaf } from '../native-chat/native-chat-leaf-routing'
import type { TerminalPaneChatController } from './use-terminal-pane-chat-state'

/** A Claude tab nobody has switched yet opens in chat; the tab's saved choice (terminal or chat) always wins. */
export function useNativeChatDefaultViewMode(chat: TerminalPaneChatController): void {
  const {
    unifiedTabId,
    savedViewMode,
    paneCount,
    managerRef,
    tabAgentTypeByLeaf,
    terminalTab,
    getNativeChatLeafIds,
    getTabWideAgentHintLeafId,
    resolveTitleAgentForLeaf,
    isChatEligibleForLeaf,
    setChatLeafId,
    setTabViewMode
  } = chat
  const launchAgent = terminalTab?.launchAgent
  const agentForLeaf = useCallback(
    (leafId: string): string | null =>
      tabAgentTypeByLeaf[leafId] ??
      nativeChatAvailabilityAgent({
        launchAgent: nativeChatLaunchAgentForLeaf({
          launchAgent,
          launchAgentLeafId: getTabWideAgentHintLeafId(),
          leafId,
          leafIds: getNativeChatLeafIds()
        }),
        resolvedAgent: resolveTitleAgentForLeaf(leafId)
      }),
    [
      tabAgentTypeByLeaf,
      launchAgent,
      getNativeChatLeafIds,
      getTabWideAgentHintLeafId,
      resolveTitleAgentForLeaf
    ]
  )
  useEffect(() => {
    if (!unifiedTabId || savedViewMode) {
      return
    }
    const leafId = managerRef.current?.getActivePane()?.leafId ?? null
    if (!leafId) {
      return
    }
    const mode = resolveDefaultNativeChatViewMode({
      savedViewMode,
      agent: agentForLeaf(leafId),
      chatAvailable: isChatEligibleForLeaf(leafId)
    })
    if (mode === 'chat') {
      setChatLeafId(leafId)
      setTabViewMode(unifiedTabId, 'chat')
    }
  }, [
    agentForLeaf,
    isChatEligibleForLeaf,
    managerRef,
    paneCount,
    savedViewMode,
    setChatLeafId,
    setTabViewMode,
    unifiedTabId
  ])
}
