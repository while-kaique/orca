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

  it('hangs the chats of a closed PO under the open active PO, or under the PO being launched', () => {
    const registry = {
      folder: 'C:/p/orca',
      chats: {
        'po-antigo': { papel: 'po', pai: null, ativo: true },
        'po-novo': { papel: 'po', pai: null, ativo: true },
        exec: { papel: 'executor', pai: 'po-antigo', ativo: true }
      },
      ordens: {},
      fila: []
    } as unknown as CanvasHierarchySnapshot
    const withOpenPo = [chat('po-novo'), chat('exec')]
    linkProjectChats(withOpenPo, new Map(), [registry], ['C:/p/orca'])
    expect(withOpenPo[1].parentKey).toBe('po-novo')

    const launching = { ...chat('abrindo'), launching: true } as CanvasChat
    const whileLaunching = [launching, chat('exec')]
    linkProjectChats(whileLaunching, new Map(), [registry], ['C:/p/orca'])
    expect(whileLaunching[1].parentKey).toBe('abrindo')
  })

  it('hangs an executor whose planner closed under the nearest open ancestor, never the project', () => {
    const registry = {
      folder: 'C:/p/orca',
      chats: {
        po: { papel: 'po', pai: null, ativo: true },
        'plan-fechado': { papel: 'planejador', pai: 'po', ativo: false },
        exec: { papel: 'executor', pai: 'plan-fechado', ativo: true },
        orfao: { papel: 'executor', pai: 'sumiu-do-registro', ativo: true }
      },
      ordens: {},
      fila: []
    } as unknown as CanvasHierarchySnapshot
    const chats = [chat('po'), chat('exec'), chat('orfao')]
    linkProjectChats(chats, new Map(), [registry], ['C:/p/orca'])
    expect(chats.map((c) => c.parentKey)).toEqual([null, 'po', 'po'])
  })

  it('holds a new tab made by a hierarchy chat under it until its record arrives, and no longer than that', () => {
    const lineage = new Map([['w-filho', 'w-main']])
    const build = (): { po: CanvasChat; child: CanvasChat } => ({
      po: { ...chat('po'), worktreeId: 'w-main' } as CanvasChat,
      child: { ...chat('filho'), worktreeId: 'w-filho' } as CanvasChat
    })
    const registry = [snapshot('C:/p/orca', 'po', 'po')]

    const waiting = build()
    linkProjectChats(
      [waiting.po, waiting.child],
      new Map(),
      registry,
      ['C:/p/orca'],
      lineage,
      new Set(['filho'])
    )
    expect([waiting.child.parentKey, waiting.child.launching]).toEqual(['po', true])

    const settled = build()
    linkProjectChats([settled.po, settled.child], new Map(), registry, ['C:/p/orca'], lineage)
    expect([settled.child.parentKey, settled.child.launching ?? false]).toEqual([null, false])
  })

  // Chaves da prova juncao-o-047/restaurar (depois-cards.json): o antigo dd95f879 e o novo 6beb0dd2 do mesmo chat.
  describe('chat restored by hierarquia restaurar', () => {
    const OLD = 'dd95f879-84c8-4ef3-84e4-712c3f28e393'
    const NEW = '6beb0dd2-8f66-4023-b29e-64e020b39cc0'
    const registry = {
      folder: 'C:/p/orca',
      chats: {
        po: { papel: 'po', pai: null, ativo: true },
        [OLD]: { papel: 'executor', pai: 'po', ativo: false, substituidoPor: NEW },
        [NEW]: { papel: 'executor', pai: 'po', ativo: true, restauradoDe: OLD },
        filho: { papel: 'executor', pai: NEW, ativo: true }
      },
      ordens: {},
      fila: []
    } as unknown as CanvasHierarchySnapshot

    it('draws one card: the old tab is dropped and its children hang under the new chat', () => {
      const filho = { ...chat('filho'), parentKey: OLD } as CanvasChat
      const chats = [chat('po'), chat(OLD), chat(NEW), filho]
      linkProjectChats(chats, new Map(), [registry], ['C:/p/orca'])
      expect(chats.map((c) => c.key)).toEqual(['po', NEW, 'filho'])
      expect(filho.parentKey).toBe(NEW)
    })

    it('keeps the old card while the new chat has no open tab', () => {
      const chats = [chat('po'), chat(OLD)]
      linkProjectChats(chats, new Map(), [registry], ['C:/p/orca'])
      expect(chats.map((c) => c.key)).toEqual(['po', OLD])
    })
  })
})
