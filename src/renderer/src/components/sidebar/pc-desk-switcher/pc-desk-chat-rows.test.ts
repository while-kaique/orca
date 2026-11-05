import { describe, expect, it } from 'vitest'
import type { Row } from '../../../../../shared/sidebar-list/row-types'
import {
  parsePcDeskChatTabIdsSignature,
  selectPcDeskChatTabIdsSignature,
  splitPcDeskRowsByChat
} from './pc-desk-chat-rows'

const header = { type: 'header', key: 'repo:a', label: 'Projetos', count: 1, tone: '' }
const item = (worktreeId: string) => ({
  type: 'item',
  rowKey: `repo:a:${worktreeId}`,
  sectionKey: 'repo:a',
  worktree: { id: worktreeId }
})
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the split reads only type, rowKey and worktree.id.
const rows = [header, item('wt-1'), item('wt-2')] as unknown as Row[]

describe('splitPcDeskRowsByChat', () => {
  it('gives each chat of a workspace its own row and keeps chatless workspaces', () => {
    const signature = selectPcDeskChatTabIdsSignature({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only tab ids are read.
      tabsByWorktree: { 'wt-1': [{ id: 't1' }, { id: 't2' }], 'wt-3': [] } as never
    })
    const result = splitPcDeskRowsByChat(rows, parsePcDeskChatTabIdsSignature(signature))
    expect(result.map((row) => (row.type === 'item' ? row.rowKey : row.type))).toEqual([
      'header',
      'repo:a:wt-1#chat:t1',
      'repo:a:wt-1#chat:t2',
      'repo:a:wt-2'
    ])
    expect(result[1]).toMatchObject({ pcDeskTabId: 't1' })
    expect(result[3]).not.toHaveProperty('pcDeskTabId')
  })

  it('keeps worktree ids that contain colons and backslashes intact', () => {
    const id = String.raw`repo-1::C:\Users\User\Desktop\Projetos`
    const map = parsePcDeskChatTabIdsSignature(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only tab ids are read.
      selectPcDeskChatTabIdsSignature({ tabsByWorktree: { [id]: [{ id: 'x' }] } as never })
    )
    expect(map.get(id)).toEqual(['x'])
  })
})
