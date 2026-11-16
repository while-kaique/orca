import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '' } }))

import { findHiddenSessions, referencedTerminalIds } from './fork-hidden-chat-sessions'

const OPENED_AT = 1_000_000

const session = (sessionId: string, paneKey: string, createdAt: number) => ({
  sessionId,
  paneKey,
  pid: 10,
  cwd: 'C:/projeto',
  createdAt,
  isAlive: true
})

describe('findHiddenSessions', () => {
  it('ends only chats a crash left running with no saved tab, never a tab chat or a fresh one', () => {
    const saved = {
      tabsByWorktree: { 'w::C:/projeto': [{ id: 'aba-com-card', ptyId: 'w::C:/projeto@@aaa' }] },
      terminalLayoutsByTabId: {
        'aba-dividida': { ptyIdsByLeafId: { folha: 'w::C:/projeto@@bbb' } }
      }
    }
    const sessions = [
      session('w::C:/projeto@@aaa', 'aba-com-card:folha', 500),
      session('w::C:/projeto@@bbb', 'aba-dividida:folha', 500),
      session('w::C:/projeto@@ccc', 'aba-sumida:folha', 500),
      session('w::C:/projeto@@ddd', 'aba-nova:folha', 2_000_000)
    ]
    expect(
      findHiddenSessions(sessions, referencedTerminalIds(saved), OPENED_AT).map((s) => s.sessionId)
    ).toEqual(['w::C:/projeto@@ccc'])
  })
})
