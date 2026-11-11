import { expect, it } from 'vitest'
import { chatDescendants, layoutCanvas, type CanvasProject } from './canvas-chats-layout'

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
const project = (id: string, chats: ReturnType<typeof chat>[]): CanvasProject => ({
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
  expect(boxes['project:sh'].y).toBe(boxes['project:pr'].y)
})
it('lines every top chat up on one column grid, whatever the project', () => {
  const { boxes } = layoutCanvas(four, { w: 2065, h: 1350 })
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    expect((boxes[key].x - boxes.a.x) % (340 + 52)).toBe(0)
  }
  expect(boxes.d.x).toBe(boxes.a.x)
  expect(boxes.b.x - boxes.a.x).toBe(2 * (340 + 52))
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
  expect(boxes['project:p'].x + 205).toBe(boxes.po.x + 170)
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
  expect(boxes.plan.y).toBe(boxes['po-x0'].y + 236 + 12 + 80)
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
