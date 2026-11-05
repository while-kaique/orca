import type { Store } from '../persistence'

export const PC_DESK_AGENT_SLEEP_IDLE_MS = 2 * 60 * 60 * 1000

/**
 * Fork (PC-desk): turn Agent sleep on once, with a 2 h idle window. Why: each idle Claude pane
 * holds ~1 GB (claude + MCP servers) and the Experimental pane is the only other switch.
 * Runs after load, not in the parser, so persisted-state round-trip tests stay untouched.
 */
export function applyPcDeskAgentSleepPreset(
  store: Pick<Store, 'getSettings' | 'updateSettings'>
): boolean {
  if (store.getSettings().pcDeskAgentSleepPresetApplied === true) {
    return false
  }
  store.updateSettings({
    experimentalAgentHibernation: true,
    agentHibernationIdleMs: PC_DESK_AGENT_SLEEP_IDLE_MS,
    pcDeskAgentSleepPresetApplied: true
  })
  return true
}
