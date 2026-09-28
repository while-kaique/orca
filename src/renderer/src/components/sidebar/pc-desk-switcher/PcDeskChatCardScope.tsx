import React, { useCallback } from 'react'
import { useAppStore } from '@/store'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { PcDeskChatTabContext } from './pc-desk-chat-rows'

/**
 * Wraps a sidebar card that stands for one chat: it is "active" only while that chat is the
 * visible tab, and clicking it opens that chat (after the shared workspace activation).
 */
export function PcDeskChatCardScope({
  tabId,
  isActiveWorktree,
  children
}: {
  tabId: string | undefined
  isActiveWorktree: boolean
  children: (scope: { isActive: boolean; onActivate?: () => void }) => React.ReactNode
}): React.JSX.Element {
  const isActiveTab = useAppStore((s) =>
    tabId ? s.activeTabType === 'terminal' && s.activeTabId === tabId : true
  )
  const onActivate = useCallback(() => {
    if (tabId) {
      activateTabAndFocusPane(tabId, null)
      focusTerminalTabSurface(tabId)
    }
  }, [tabId])
  if (!tabId) {
    return <>{children({ isActive: isActiveWorktree })}</>
  }
  return (
    <PcDeskChatTabContext.Provider value={tabId}>
      {children({ isActive: isActiveWorktree && isActiveTab, onActivate })}
    </PcDeskChatTabContext.Provider>
  )
}
