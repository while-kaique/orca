import type { Store } from '../persistence/loading-store/store'
import { TUI_AGENT_CONFIG } from '../../shared/agent-launch/catalog/tui-agent-config'
import type { TuiAgent } from '../../shared/agent-launch/catalog/tui-agent'

/** Agents the Orca enxuto build keeps on; every other one starts disabled (see REMOVIDOS.md). */
export const ORCA_ENXUTO_KEPT_AGENTS: readonly TuiAgent[] = ['claude', 'claude-agent-teams']

/**
 * Fork (Orca enxuto): disable every agent except Claude and hide the mobile button, once. Disabled agents skip PATH
 * detection, managed-hook installs and pickers. One-shot so Settings > Agents can turn any
 * agent back on later and the choice sticks.
 */
export function applyOrcaEnxutoAgentsPreset(
  store: Pick<Store, 'getSettings' | 'updateSettings'>
): boolean {
  const settings = store.getSettings()
  if (settings.orcaEnxutoAgentsPresetApplied === true) {
    return false
  }
  const disabled = (Object.keys(TUI_AGENT_CONFIG) as TuiAgent[]).filter(
    (agent) => !ORCA_ENXUTO_KEPT_AGENTS.includes(agent)
  )
  store.updateSettings({
    disabledTuiAgents: disabled,
    // Mobile relay is off (ORCA_ENXUTO_SWITCHES.mobileRelay), so hide its sidebar button.
    showMobileButton: false,
    orcaEnxutoAgentsPresetApplied: true
  })
  return true
}
