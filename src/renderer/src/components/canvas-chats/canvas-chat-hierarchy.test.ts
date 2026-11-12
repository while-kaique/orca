import { describe, expect, it } from 'vitest'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import { linkProjectChats } from './canvas-chat-hierarchy'
import type { CanvasChat } from './canvas-chats-layout'

function chat(key: string): CanvasChat {
  return { key, parentKey: null, hierarchy: null } as unknown as CanvasChat
}

function snapshot(
  folder: string,
  chatId: string,
  papel: 'po' | 'executor'
): CanvasHierarchySnapshot {
  return {
    folder,
    chats: {
      [chatId]: { papel, pai: null, ordemId: null, mexidoPeloKaique: false }
    } as unknown as CanvasHierarchySnapshot['chats'],
    ordens: {},
    fila: []
  }
}

describe('linkProjectChats', () => {
  it('reads every registry in the project folders, not only the first one found', () => {
    const chats = [chat('teste'), chat('real')]
    linkProjectChats(
      chats,
      new Map(),
      [snapshot('C:/w/goatfish', 'teste', 'po'), snapshot('C:/p/orca', 'real', 'executor')],
      ['C:/w/goatfish', 'C:/p/orca']
    )
    expect(chats.map((c) => c.hierarchy?.role ?? 'livre')).toEqual(['po', 'executor'])
  })
})
