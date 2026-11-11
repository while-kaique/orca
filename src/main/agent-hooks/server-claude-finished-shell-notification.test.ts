import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentHookServer, _internals } from './server'
import { buildBody, PANE, postHookEvent, RUNNING_SHELL } from './server.test-fixtures'

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

const SECOND_SHELL = { id: 'shell-2', type: 'shell', status: 'running' }

async function hook(payload: Record<string, unknown>): Promise<void> {
  const response = await postHookEvent(server, buildBody({ session_id: 'session-1', ...payload }))
  expect(response.status).toBe(204)
}

function row() {
  return server.getStatusSnapshotForPane(PANE)[0]
}

function title(value: string): void {
  server.observeClaudeTerminalEvidence(PANE, {
    kind: 'title',
    title: value,
    staleWorkingTitleClear: false
  })
}

function notification(taskId: string, status: string): string {
  return `<task-notification>\n<task-id>${taskId}</task-id>\n<status>${status}</status>\n<summary>Background command finished</summary>\n</task-notification>`
}

// Claude sends no Stop for an interrupted turn, so the notification is the last word on the shell.
async function interruptWakeTurn(taskId: string, status: string): Promise<void> {
  await hook({ hook_event_name: 'UserPromptSubmit', prompt: notification(taskId, status) })
  title('◐ Wake')
  server.observeClaudeTerminalEvidence(PANE, { kind: 'input', data: '\x1b' })
  title('✳ Wake')
}

describe('Claude shell reported finished by its notification', () => {
  it('settles to done when the interrupted wake turn was the last running shell', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'start' })
    await hook({ hook_event_name: 'Stop', background_tasks: [RUNNING_SHELL] })
    expect(row()).toMatchObject({ state: 'working', workingMode: 'monitoring' })

    await interruptWakeTurn('shell-1', 'completed')

    expect(row()).toMatchObject({ state: 'done', mainAgent: { state: 'done' } })
    expect(row().workingMode).toBeUndefined()
  })

  it('keeps monitoring while another shell from the inventory still runs', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'start' })
    await hook({ hook_event_name: 'Stop', background_tasks: [RUNNING_SHELL, SECOND_SHELL] })

    await interruptWakeTurn('shell-1', 'completed')

    expect(row()).toMatchObject({ state: 'working', workingMode: 'monitoring' })
  })

  it('keeps monitoring when the notification names a task the inventory never listed', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'start' })
    await hook({ hook_event_name: 'Stop', background_tasks: [RUNNING_SHELL] })

    await interruptWakeTurn('shell-9', 'completed')

    expect(row()).toMatchObject({ state: 'working', workingMode: 'monitoring' })
  })

  it('keeps monitoring when the notification does not report the shell as finished', async () => {
    await hook({ hook_event_name: 'UserPromptSubmit', prompt: 'start' })
    await hook({ hook_event_name: 'Stop', background_tasks: [RUNNING_SHELL] })

    await interruptWakeTurn('shell-1', 'running')

    expect(row()).toMatchObject({ state: 'working', workingMode: 'monitoring' })
  })
})
