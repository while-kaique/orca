import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer, _internals } from './server'
import { buildBody, PANE, postHookEvent } from './server.test-fixtures'

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn() }))

let server: AgentHookServer

beforeEach(async () => {
  _internals.resetCachesForTests()
  server = new AgentHookServer()
  await server.start({ env: 'production' })
})

afterEach(() => {
  server.stop()
  vi.restoreAllMocks()
})

async function hook(payload: Record<string, unknown>): Promise<void> {
  const response = await postHookEvent(server, buildBody({ session_id: 'session-1', ...payload }))
  expect(response.status).toBe(204)
}

function row() {
  return server.getStatusSnapshotForPane(PANE)[0]
}

describe('Claude PermissionRequest in auto mode', () => {
  it('keeps a command the auto mode approved on its own as working', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'roda o build' })
    await hook({
      hook_event_name: 'PermissionRequest',
      permission_mode: 'auto',
      tool_name: 'Bash',
      tool_input: { command: 'pnpm build' }
    })

    expect(row()).toMatchObject({ state: 'working', toolName: 'Bash', toolInput: 'pnpm build' })
  })

  it('shows Needs You for a permission request outside auto mode', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'roda o build' })
    await hook({
      hook_event_name: 'PermissionRequest',
      permission_mode: 'default',
      tool_name: 'Bash',
      tool_input: { command: 'pnpm build' }
    })

    expect(row()).toMatchObject({ state: 'waiting', toolName: 'Bash', toolInput: 'pnpm build' })
  })

  it('shows Needs You for a permission request that does not report its mode', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'roda o build' })
    await hook({
      hook_event_name: 'PermissionRequest',
      tool_name: 'Bash',
      tool_input: { command: 'pnpm build' }
    })

    expect(row()).toMatchObject({ state: 'waiting' })
  })

  it.each(['AskUserQuestion', 'ExitPlanMode'])(
    'still waits for the person on %s in auto mode',
    async (toolName) => {
      await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'planeja' })
      await hook({
        hook_event_name: 'PermissionRequest',
        permission_mode: 'auto',
        tool_name: toolName,
        tool_input: {}
      })

      expect(row()).toMatchObject({ state: 'waiting', toolName })
    }
  )
})
