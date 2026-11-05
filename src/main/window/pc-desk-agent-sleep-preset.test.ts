import { describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../shared/global-settings-types'
import {
  applyPcDeskAgentSleepPreset,
  PC_DESK_AGENT_SLEEP_IDLE_MS
} from './pc-desk-agent-sleep-preset'

function fakeStore(settings: Partial<GlobalSettings>) {
  const updateSettings = vi.fn()
  // SAFETY: the preset reads only the two hibernation keys and the guard flag.
  // oxlint-disable-next-line typescript/consistent-type-assertions
  return { getSettings: () => settings as GlobalSettings, updateSettings }
}

describe('applyPcDeskAgentSleepPreset', () => {
  it('turns Agent sleep on with a 2 h idle window the first time', () => {
    const store = fakeStore({
      experimentalAgentHibernation: false,
      agentHibernationIdleMs: 1800000
    })
    expect(applyPcDeskAgentSleepPreset(store)).toBe(true)
    expect(store.updateSettings).toHaveBeenCalledWith({
      experimentalAgentHibernation: true,
      agentHibernationIdleMs: PC_DESK_AGENT_SLEEP_IDLE_MS,
      pcDeskAgentSleepPresetApplied: true
    })
  })

  it('never touches settings again once applied, so the user can turn it off', () => {
    const store = fakeStore({
      experimentalAgentHibernation: false,
      pcDeskAgentSleepPresetApplied: true
    })
    expect(applyPcDeskAgentSleepPreset(store)).toBe(false)
    expect(store.updateSettings).not.toHaveBeenCalled()
  })
})
