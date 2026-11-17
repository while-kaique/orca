import { describe, expect, it } from 'vitest'
import { selectLocalClaudeChats, suspendAllThenSave } from './suspend-all-pc-desk-chats'

const leaf = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`

const entry = (agentType: string) => ({ agentType, stateStartedAt: 1 })

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the selection reads only these five fields.
const state = {
  tabsByWorktree: {
    'wt-a': [{ id: 'chat-visible' }, { id: 'shell' }],
    'wt-b': [{ id: 'chat-hidden' }, { id: 'chat-codex' }, { id: 'chat-remote' }]
  },
  agentStatusByPaneKey: {
    [`chat-visible:${leaf(1)}`]: entry('claude'),
    [`chat-hidden:${leaf(2)}`]: entry('claude'),
    [`chat-codex:${leaf(3)}`]: entry('codex'),
    [`chat-remote:${leaf(4)}`]: entry('claude')
  },
  terminalLayoutsByTabId: {
    'chat-visible': { ptyIdsByLeafId: { [leaf(1)]: 'pty-1' } },
    'chat-hidden': { ptyIdsByLeafId: { [leaf(2)]: 'pty-2' } },
    'chat-codex': { ptyIdsByLeafId: { [leaf(3)]: 'pty-3' } },
    'chat-remote': { ptyIdsByLeafId: { [leaf(4)]: 'remote-pty' } },
    shell: { ptyIdsByLeafId: { [leaf(5)]: 'pty-5' } }
  },
  ptyIdsByTabId: {
    'chat-visible': ['pty-1'],
    'chat-hidden': ['pty-2'],
    'chat-codex': ['pty-3'],
    'chat-remote': ['remote-pty'],
    shell: ['pty-5']
  }
} as unknown as Parameters<typeof selectLocalClaudeChats>[0]

describe('selectLocalClaudeChats', () => {
  it('takes every local Claude chat of every project and no shell, other agent or remote chat', () => {
    expect(selectLocalClaudeChats(state, (_worktreeId, ptyId) => ptyId !== 'remote-pty')).toEqual([
      { worktreeId: 'wt-a', tabId: 'chat-visible' },
      { worktreeId: 'wt-b', tabId: 'chat-hidden' }
    ])
  })
})

describe('suspendAllThenSave', () => {
  const chats = [
    { worktreeId: 'wt-a', tabId: 'a' },
    { worktreeId: 'wt-b', tabId: 'b' }
  ]

  it('suspends every chat first and saves the session only after they all settled', async () => {
    const steps: string[] = []
    const report = await suspendAllThenSave({
      chats,
      suspend: async (chat) => {
        steps.push(`suspend:${chat.tabId}`)
        return chat.tabId === 'a'
      },
      saveSession: () => steps.push('save'),
      deadline: new Promise(() => {})
    })
    expect(steps).toEqual(['suspend:a', 'suspend:b', 'save'])
    expect(report).toEqual({ suspended: 1, notSuspended: 1, timedOut: false })
  })

  it('saves anyway when the deadline comes first, and reports the chat still pending as timed out', async () => {
    const steps: string[] = []
    const report = await suspendAllThenSave({
      chats,
      suspend: (chat) =>
        chat.tabId === 'a' ? Promise.resolve(true) : new Promise<boolean>(() => {}),
      saveSession: () => steps.push('save'),
      deadline: Promise.resolve()
    })
    expect(steps).toEqual(['save'])
    expect(report.timedOut).toBe(true)
  })
})
