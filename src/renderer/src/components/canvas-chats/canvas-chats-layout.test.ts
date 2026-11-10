import { expect, it } from 'vitest'
import { layoutCanvas, type CanvasProject } from './canvas-chats-layout'

const chat = (key: string, extras = 0) => ({
  key,
  projectId: 'p',
  worktreeId: 'w',
  tabId: key,
  cwd: '',
  paneKey: null,
  ptyId: null,
  startedAt: 0,
  title: key,
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
  chats
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
