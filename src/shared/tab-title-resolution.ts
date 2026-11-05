import type { Tab } from './tab-types'
import type { TerminalTab } from './workspace-layout/terminal-tab-types'
import { isMeaningfulOpenCodeTerminalTitle } from './agent-status/title/providers/opencode-terminal-title'
import { capSessionTitle } from './session-title-cap'
import { preferredPcDeskSessionTitle } from './pc-desk-session-title'

export function resolveTerminalTabTitle(
  tab: Pick<TerminalTab, 'quickCommandLabel' | 'aiVaultTitle' | 'generatedTitle' | 'title'> & {
    customTitle?: string | null
  },
  generatedTitlesEnabled: boolean,
  fallback = ''
): string {
  const liveTitle = tab.title?.trim() ?? ''
  return (
    tab.customTitle?.trim() ||
    tab.quickCommandLabel?.trim() ||
    // Why: names the user typed stay whole; only auto-generated ones are capped.
    capSessionTitle(
      preferredPcDeskSessionTitle(tab.generatedTitle) ||
        (isMeaningfulOpenCodeTerminalTitle(liveTitle) ? liveTitle : '') ||
        tab.aiVaultTitle?.title.trim() ||
        (generatedTitlesEnabled ? tab.generatedTitle?.trim() : '') ||
        liveTitle
    ) ||
    fallback
  )
}

export function resolveUnifiedTabLabel(
  tab:
    | Pick<Tab, 'customLabel' | 'quickCommandLabel' | 'aiVaultTitle' | 'generatedLabel' | 'label'>
    | undefined,
  generatedTitlesEnabled: boolean,
  fallback = ''
): string {
  const liveLabel = tab?.label?.trim() ?? ''
  return (
    tab?.customLabel?.trim() ||
    tab?.quickCommandLabel?.trim() ||
    capSessionTitle(
      preferredPcDeskSessionTitle(tab?.generatedLabel) ||
        (isMeaningfulOpenCodeTerminalTitle(liveLabel) ? liveLabel : '') ||
        tab?.aiVaultTitle?.title.trim() ||
        (generatedTitlesEnabled ? tab?.generatedLabel?.trim() : '') ||
        liveLabel
    ) ||
    fallback
  )
}
