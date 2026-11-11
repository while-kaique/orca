import { expect, it } from 'vitest'
import {
  chatDescendants,
  layoutCanvas,
  type CanvasChat,
  type CanvasProject
} from './canvas-chats-layout'

const chat = (key: string, extras = 0, parentKey: string | null = null) => ({
  key,
  projectId: 'p',
  worktreeId: 'w',
  tabId: key,
  cwd: '',
  paneKey: null,
  ptyId: null,
  startedAt: 0,
  title: key,
  parentKey,
  model: null,
  transcriptPath: null,
  hierarchy: null,
  status: 'idle' as const,
  lines: [],
  agents: [],
  extras: Array.from({ length: extras }, (_, i) => ({
    id: `${key}-x${i}`,
    kind: 'artifact' as const,
    label: '',
    url: ''
  }))
})
const project = (id: string, chats: CanvasChat[]): CanvasProject => ({
  id,
  name: id,
  color: '',
  initials: '',
  detail: '',
  chats,
  queue: []
})
const four = [
  project('cs', [chat('a')]),
  project('ad', [chat('b', 3), chat('c')]),
  project('sh', [chat('d')]),
  project('pr', [chat('e'), chat('f'), chat('g', 1)])
]
it('does not crash before the viewport is measured', () => {
  expect(() => layoutCanvas(four, { w: 0, h: 0 })).not.toThrow()
})
it('puts 4 projects in a 2x2 grid on a wide screen', () => {
  const { boxes } = layoutCanvas(four, { w: 2065, h: 1350 })
  expect(boxes['project:cs'].y).toBe(boxes['project:ad'].y)
  expect(boxes['project:sh'].y).toBeGreaterThan(boxes['project:cs'].y)
})
it('stacks a project right under the one above it in its columns, with the column gap', () => {
  const { boxes } = layoutCanvas(four, { w: 2065, h: 1350 })
  // cs ends at 426 (header 116 + 80 + chat 230); ad, with chips under a chat, at 464; the gap is 374.
  expect(boxes['project:sh'].y).toBe(800)
  // pr is in ad's columns, so it goes under ad, not under cs.
  expect(boxes['project:pr'].y).toBe(838)
})
it('lines every top chat up on one column grid, whatever the project', () => {
  const { boxes } = layoutCanvas(four, { w: 2065, h: 1350 })
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    expect((boxes[key].x - boxes.a.x) % (340 + 52)).toBe(0)
  }
  expect(boxes.d.x).toBe(boxes.a.x)
  expect(boxes.b.x - boxes.a.x).toBe(2 * (340 + 52))
  expect(boxes['project:cs'].x).toBe(boxes.a.x)
  expect(boxes['project:sh'].x).toBe(boxes['project:cs'].x)
  expect(boxes['project:pr'].x).toBe(boxes['project:ad'].x)
})
const wide = { w: 4000, h: 3000 }
it('puts the chats a chat created in a row below it, centered under it', () => {
  const { boxes } = layoutCanvas(
    [project('p', [chat('po'), chat('plan1', 0, 'po'), chat('plan2', 0, 'po')])],
    wide
  )
  expect(boxes.plan1.y).toBe(boxes.po.y + 230 + 80)
  expect(boxes.plan2.y).toBe(boxes.plan1.y)
  expect(boxes.plan2.x - boxes.plan1.x).toBe(340 + 52)
  expect(boxes.po.x + 170).toBe((boxes.plan1.x + boxes.plan2.x + 340) / 2)
  expect(boxes['project:p'].x).toBe(boxes.po.x)
})
it('stacks three levels and keeps cousins from overlapping', () => {
  const { boxes } = layoutCanvas(
    [
      project('p', [
        chat('po'),
        chat('plan1', 0, 'po'),
        chat('plan2', 0, 'po'),
        chat('e1', 0, 'plan1'),
        chat('e2', 0, 'plan1'),
        chat('e3', 0, 'plan2')
      ])
    ],
    wide
  )
  expect(boxes.e1.y).toBe(boxes.plan1.y + 230 + 80)
  expect(boxes.e3.y).toBe(boxes.e1.y)
  expect(boxes.e3.x).toBeGreaterThanOrEqual(boxes.e2.x + 340 + 52)
  expect(boxes.plan1.x + 170).toBe((boxes.e1.x + boxes.e2.x + 340) / 2)
})
it('starts the created chats below what hangs off their creator', () => {
  const { boxes } = layoutCanvas([project('p', [chat('po', 1), chat('plan', 0, 'po')])], wide)
  // One thin row of chips (8 + 30) hangs under the creator, whatever it left behind.
  expect(boxes.plan.y).toBe(boxes.po.y + 230 + 38 + 80)
})
it('keeps a chat whose creator is gone, or in a creation loop, as a top chat', () => {
  const { boxes } = layoutCanvas(
    [project('p', [chat('orphan', 0, 'closed'), chat('a', 0, 'b'), chat('b', 0, 'a')])],
    wide
  )
  expect(boxes.orphan.y).toBe(boxes.a.y)
  expect(boxes.a.y).toBe(boxes.b.y)
  expect(boxes.a.y).toBe(boxes['project:p'].y + 116 + 80)
})
it('lists everything below a chat so it can be dragged as one piece', () => {
  const chats = [chat('po'), chat('plan', 0, 'po'), chat('exec', 0, 'plan'), chat('other')]
  expect(chatDescendants(chats, 'po').map((c) => c.key)).toEqual(['plan', 'exec'])
  expect(chatDescendants(chats, 'other')).toEqual([])
})
const role = (c: CanvasChat, r: 'po' | 'planejador' | 'executor'): CanvasChat => ({
  ...c,
  hierarchy: { role: r, order: null, toCheck: 0, touchedByUser: false }
})
it('keeps executors below the planners row even when the PO created them directly', () => {
  const { boxes } = layoutCanvas(
    [
      project('p', [
        role(chat('po'), 'po'),
        role(chat('direct', 0, 'po'), 'executor'),
        role(chat('plan', 0, 'po'), 'planejador'),
        role(chat('exec', 0, 'plan'), 'executor')
      ])
    ],
    wide
  )
  expect(boxes.plan.y).toBe(boxes.po.y + 230 + 80)
  // The planners' row is as tall as a slim card (106), not a full one.
  expect(boxes.exec.y).toBe(boxes.plan.y + 106 + 80)
  expect(boxes.direct.y).toBe(boxes.exec.y)
  expect(boxes.plan.x).toBeLessThan(boxes.direct.x)
})
it('does not push a row down for what hangs off a chat with nothing below it', () => {
  const { boxes } = layoutCanvas(
    [project('p', [chat('alone', 2), chat('po'), chat('plan', 0, 'po')])],
    wide
  )
  expect(boxes.plan.y).toBe(boxes.po.y + 230 + 80)
})
