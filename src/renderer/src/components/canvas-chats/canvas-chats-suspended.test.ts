import { describe, expect, it } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-resume'
import { buildCanvasProjects } from './canvas-chats-data'
import {
  LEAF,
  NOW,
  SCENARIO_STORE,
  WORKTREE,
  scenarioStoreWithStates
} from './canvas-chats-fixture-scenario'

type Inputs = Parameters<typeof buildCanvasProjects>[0]

function statusesFor(tabsWithoutProcess: string[]): Record<string, string> {
  const base = scenarioStoreWithStates({ po: 'done', livre: 'done' })
  const ptys = { ...base.ptyIdsByTabId }
  const statuses = { ...base.agentStatusByPaneKey }
  const records: Record<string, SleepingAgentSessionRecord> = {}
  for (const tab of tabsWithoutProcess) {
    delete ptys[tab]
    delete statuses[`${tab}:${LEAF}`]
    records[`${tab}:${LEAF}`] = {
      paneKey: `${tab}:${LEAF}`,
      tabId: tab,
      worktreeId: WORKTREE,
      agent: 'claude',
      providerSession: { key: 'session_id', id: tab },
      prompt: 'p',
      state: 'working',
      capturedAt: NOW,
      updatedAt: NOW,
      origin: 'worktree-sleep',
      restoreOnTabOpenOnly: true
    }
  }
  const projects = buildCanvasProjects({
    ...SCENARIO_STORE,
    unifiedTabsByWorktree: {},
    retainedAgentsByPaneKey: {},
    acknowledgedAgentsByPaneKey: {},
    migrationUnsupportedByPtyId: {},
    worktreeLineageById: {},
    ptyIdsByTabId: ptys,
    agentStatusByPaneKey: statuses,
    sleepingAgentSessionsByPaneKey: records,
    artifactLinks: {},
    hierarchy: [],
    newTabs: new Set()
  } as unknown as Inputs)
  return Object.fromEntries(projects.flatMap((p) => p.chats).map((c) => [c.tabId, c.status]))
}

describe('suspended chat', () => {
  it('is a chat with a saved conversation and no live process, and only that chat', () => {
    const status = statusesFor(['po'])
    expect(status.po).toBe('suspended')
    expect(status.livre).toBe('seen')
  })

  it('stops being suspended when its process is back', () => {
    expect(statusesFor([]).po).toBe('seen')
  })
})
