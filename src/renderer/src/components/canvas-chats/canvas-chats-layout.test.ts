import { expect, it } from 'vitest'
import {
  chatDescendants,
  chipsHeight,
  planBlocks,
  isFreeChat,
  type CanvasBox,
  type CanvasChat,
  type CanvasProject
} from './canvas-chats-layout'
import { layoutCanvas, type CanvasInsets } from './canvas-chats-arrangement'
import { chatVisualBox } from './canvas-chat-shape'
import { anchoredPlacement, chatParents, convertLegacyPlacement } from './canvas-chats-anchors'
import { drawnBounds, fitView } from './canvas-chats-fit'
import { largestHole } from './canvas-chats-holes'
import { legacyAutoBoxes } from './canvas-chats-layout-legacy'
import {
  applyCanvasOffsets,
  effectiveOffset,
  type CanvasOffsets,
  type CanvasZone
} from './canvas-chats-offsets'

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
  hierarchy: { role: 'po' as const, order: null, toCheck: 0, touchedByUser: false },
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
  // The project card (410 wide) is centered over the PO (340 wide): the line down is straight.
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
const free = (c: CanvasChat): CanvasChat => ({ ...c, hierarchy: null })
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
it('puts free chats side by side above the project, level, and leaves the hierarchy where it was', () => {
  const hierarchy = [
    role(chat('po'), 'po'),
    role(chat('plan', 0, 'po'), 'planejador'),
    role(chat('exec', 0, 'plan'), 'executor')
  ]
  const before = layoutCanvas([project('p', hierarchy)], wide).boxes
  const { boxes } = layoutCanvas(
    [project('p', [...hierarchy, free(chat('f1')), free(chat('f2'))])],
    wide
  )
  // The block grew upward by one chat (230) and the 80 gap: the project card moved down by 310.
  expect(boxes['project:p'].y - before['project:p'].y).toBe(310)
  for (const key of ['po', 'plan', 'exec']) {
    expect(boxes[key].y - before[key].y).toBe(310)
    // The block may widen for the free row, which re-centers the hierarchy as one piece.
    expect(boxes[key].x - boxes.po.x).toBe(before[key].x - before.po.x)
  }
  expect(boxes.f1.y + 230 + 80).toBe(boxes['project:p'].y)
  expect(boxes.f2.y).toBe(boxes.f1.y)
  expect(boxes.f2.x - boxes.f1.x).toBe(340 + 52)
})
it('puts every chat above a project that has no PO and nothing below it', () => {
  const { boxes } = layoutCanvas(
    [project('p', [free(chat('a')), free(chat('b')), free(chat('c'))])],
    wide
  )
  expect(boxes.a.y).toBe(boxes['project:p'].y - 80 - 230)
  expect(boxes.c.x).toBe(boxes.a.x + 2 * (340 + 52))
  expect(boxes['project:p'].x + 205).toBe(boxes.b.x + 170)
  expect(boxes['project:p'].y).toBe(boxes.a.y + 230 + 80)
})
it('keeps the chips that hang above a free chat inside the block, not on the project', () => {
  const { boxes } = layoutCanvas([project('p', [free(chat('a', 2))])], wide)
  // Chips (8 + 30) sit above the chat, so the chat starts 38 below the block top.
  expect(boxes.a.y).toBe(38)
  expect(boxes['project:p'].y).toBe(38 + 230 + 80)
})
it('does not let a project below overlap the free chats of the project above it', () => {
  const { boxes } = layoutCanvas(
    [
      project('top', [role(chat('t'), 'po'), free(chat('tf'))]),
      project('low', [role(chat('l'), 'po'), free(chat('lf'))])
    ],
    { w: 700, h: 2400 }
  )
  const [top, low] = [project('top', []), project('low', [])]
  expect(
    [top, low].length === 2 &&
      [boxes.t, boxes.tf, boxes['project:top']].every((a) =>
        [boxes.l, boxes.lf, boxes['project:low']].every((b) => {
          const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))
          const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h))
          return gapX >= 52 || gapY >= 52
        })
      )
  ).toBe(true)
})
it('does not drag the chats below a hierarchy chat together with a free chat', () => {
  const chats = [
    role(chat('po'), 'po'),
    free(chat('f', 0, 'po')),
    role(chat('plan', 0, 'po'), 'planejador')
  ]
  expect(chatDescendants(chats, 'po').map((c) => c.key)).toEqual(['plan'])
  expect(chatDescendants(chats, 'f')).toEqual([])
})

// ---- Outline fitting, anchors and the saved-state conversion -------------------------------------------------------

type Spec = [
  key: string,
  kind: 'po' | 'planejador' | 'executor' | 'livre',
  parent?: string,
  chips?: number
]
const team = (id: string, specs: Spec[]): CanvasProject =>
  project(
    id,
    specs.map(([key, kind, parent, chips]) => {
      const base = chat(`${id}-${key}`, chips ?? 0, parent ? `${id}-${parent}` : null)
      return kind === 'livre' ? free(base) : role(base, kind)
    })
  )
// The board of the 4-project print: 2151 x 1370 px; the legend and buttons take 64 px at the bottom.
const board = { w: 2151, h: 1370 }
const insets: CanvasInsets = { bottom: 64, pad: 32 }
const astra = team('astra', [
  ['free', 'livre', undefined, 1],
  ['po', 'po'],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan']
])
const social4 = team('social', [
  ['po', 'po', undefined, 1],
  ['plan', 'planejador', 'po'],
  ['e1', 'executor', 'plan'],
  ['e2', 'executor', 'plan'],
  ['e3', 'executor', 'po'],
  ['e4', 'executor', 'po', 1],
  ['e5', 'executor', 'po', 1]
])
const orca1 = team('orca', [['po', 'po']])
const so = team('so', [['free', 'livre']])
const poWidthOnScreen = (projects: CanvasProject[]): number => {
  const { boxes } = layoutCanvas(projects, board, insets)
  return fitView(drawnBounds(projects, boxes), board, insets).s * 340
}

it('4 projects of the hand-arranged print: the PO card is at least as big as on the print (209 px)', () => {
  expect(poWidthOnScreen([astra, orca1, so, social4])).toBeGreaterThanOrEqual(209)
})
const orca3 = team('orca', [
  ['po', 'po', undefined, 1],
  ['e1', 'executor', 'po'],
  ['e2', 'executor', 'po']
])
it('3 projects, case 1 of the hand-arranged prints: the PO card is at least 278 px', () => {
  const social = team('social', [
    ['po', 'po', undefined, 1],
    ['plan', 'planejador', 'po'],
    ['e1', 'executor', 'po']
  ])
  expect(poWidthOnScreen([orca3, social, astra])).toBeGreaterThanOrEqual(278)
})
it('3 projects, case 2 of the hand-arranged prints: the PO card is at least 242 px', () => {
  const social = team('social', [
    ['po', 'po', undefined, 1],
    ['plan', 'planejador', 'po'],
    ['e1', 'executor', 'plan'],
    ['e2', 'executor', 'plan'],
    ['e3', 'executor', 'po', 1],
    ['e4', 'executor', 'po', 1]
  ])
  expect(poWidthOnScreen([social, orca3, astra])).toBeGreaterThanOrEqual(242)
})

it('5 projects of the 13/11 print: every project sits one column gap (52) from its nearest neighbour', () => {
  const projects = [
    team('orca', [
      ['po', 'po'],
      ['plan1', 'planejador', 'po'],
      ['plan2', 'planejador', 'po'],
      ['e1', 'executor', 'po']
    ]),
    astra,
    team('social', [
      ['po', 'po', undefined, 1],
      ['plan1', 'planejador', 'po'],
      ['plan2', 'planejador', 'po'],
      ['e1', 'executor', 'plan1'],
      ['e2', 'executor', 'plan1'],
      ['e3', 'executor', 'po', 1],
      ['e4', 'executor', 'po', 1]
    ]),
    team('projetos', [['free', 'livre']]),
    so
  ]
  const { headers } = layoutCanvas(projects, board, insets)
  const outlineOf = new Map(
    planBlocks(projects).map((plan) => {
      const h = headers[plan.block.project.id]
      return [
        plan.block.project.id,
        plan.shape.map((r) => ({
          ...r,
          x: r.x + h.x - plan.header.x,
          y: r.y + h.y - plan.header.y
        }))
      ]
    })
  )
  const nearest = [...outlineOf].map(([id, own]) => {
    const others = [...outlineOf].filter(([o]) => o !== id).flatMap(([, r]) => r)
    return Math.round(
      Math.min(
        ...own.flatMap((a) =>
          others.map((b) =>
            Math.hypot(
              Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
              Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h))
            )
          )
        )
      )
    )
  })
  expect(nearest).toEqual([52, 52, 52, 52, 52])
})

const emptyCards = (projects: CanvasProject[]): number => {
  const { headers } = layoutCanvas(projects, board, insets)
  const outlines = planBlocks(projects).flatMap((plan) => {
    const h = headers[plan.block.project.id]
    return plan.shape.map((r) => ({
      x: r.x + h.x - plan.header.x,
      y: r.y + h.y - plan.header.y,
      w: r.w,
      h: r.h
    }))
  })
  const x0 = Math.min(...outlines.map((r) => r.x))
  const y0 = Math.min(...outlines.map((r) => r.y))
  const box = {
    x: x0,
    y: y0,
    w: Math.max(...outlines.map((r) => r.x + r.w)) - x0,
    h: Math.max(...outlines.map((r) => r.y + r.h)) - y0
  }
  return largestHole(outlines, box, { gapX: 104, gapY: 80 }).cards
}
it('3 projects, both hand-arranged cases: the empty space left is smaller than in the print (3.76 and 5.89 cards)', () => {
  const social3a = team('social', [
    ['po', 'po', undefined, 1],
    ['plan', 'planejador', 'po'],
    ['e1', 'executor', 'po']
  ])
  const social3b = team('social', [
    ['po', 'po', undefined, 1],
    ['plan', 'planejador', 'po'],
    ['e1', 'executor', 'plan'],
    ['e2', 'executor', 'plan'],
    ['e3', 'executor', 'po', 1],
    ['e4', 'executor', 'po', 1]
  ])
  expect(emptyCards([orca3, social3a, astra])).toBeLessThan(3.76)
  expect(emptyCards([social3b, orca3, astra])).toBeLessThan(5.89)
})

const drawnBox = (c: CanvasChat, boxes: Record<string, CanvasBox>): CanvasBox => {
  const b = chatVisualBox(c, boxes[c.key])
  const chips = chipsHeight(c)
  return isFreeChat(c) ? { ...b, y: b.y - chips, h: b.h + chips } : { ...b, h: b.h + chips }
}
const cardsOf = (p: CanvasProject, boxes: Record<string, CanvasBox>): CanvasBox[] => [
  boxes[`project:${p.id}`],
  ...p.chats.map((c) => drawnBox(c, boxes))
]
const gap = (a: CanvasBox, b: CanvasBox): { x: number; y: number } => ({
  x: Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)),
  y: Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h))
})
const apart = (
  projects: CanvasProject[],
  boxes: Record<string, CanvasBox>,
  from: CanvasProject,
  to: CanvasProject
): boolean =>
  projects.length > 0 &&
  cardsOf(from, boxes).every((a) =>
    cardsOf(to, boxes).every((b) => {
      const g = gap(a, b)
      return g.x >= 52 || g.y >= 52
    })
  )
it('no card of a project comes closer than one column gap (52) to a card of another project', () => {
  const projects = [astra, orca1, so, social4]
  const { boxes } = layoutCanvas(projects, board, insets)
  for (const p of projects) {
    for (const q of projects.filter((o) => o !== p)) {
      expect(apart(projects, boxes, p, q)).toBe(true)
    }
  }
})
it("puts a project under or beside another one inside the other's bounding box", () => {
  const projects = [astra, orca1, so, social4]
  const { boxes } = layoutCanvas(projects, board, insets)
  const inside = projects.some((p) =>
    projects.some((q) => {
      const a = drawnBounds([p], boxes)
      const b = drawnBounds([q], boxes)
      return p !== q && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    })
  )
  expect(inside).toBe(true)
})
it('starts every card of a project on a multiple of half a column (196), counted from its first chat', () => {
  const projects = [astra, orca1, so, social4]
  const { boxes } = layoutCanvas(projects, board, insets)
  for (const p of projects) {
    const origin = boxes[p.chats[0].key].x
    // The project card is not on the grid: it is centered over its top chat.
    for (const key of p.chats.map((c) => c.key)) {
      expect((((boxes[key].x - origin) % 196) + 196) % 196).toBe(0)
    }
  }
})
it('centers every project card over its PO, so the line from the card to the PO is straight', () => {
  const projects = [astra, orca1, so, social4]
  const { boxes } = layoutCanvas(projects, board, insets)
  expect(boxes['project:astra'].x + 205).toBe(boxes['astra-po'].x + 170)
  expect(boxes['project:orca'].x + 205).toBe(boxes['orca-po'].x + 170)
  expect(boxes['project:social'].x + 205).toBe(boxes['social-po'].x + 170)
})
it('measures the biggest empty space inside a drawing in cards of 340 x 230', () => {
  const band = [{ x: 0, y: 0, w: 800, h: 120 }]
  const box = { x: 0, y: 0, w: 800, h: 400 }
  // Below the band: 800 x 280 free (280 = 7 cells of 40) = 224000 / 78200 cards.
  expect(largestHole(band, box, { gapX: 0, gapY: 0 }).area).toBe(224000)
  // With the 80 gap below the band the free part is 800 x 200 = 160000.
  expect(largestHole(band, box, { gapX: 104, gapY: 80 }).area).toBe(160000)
})
it('puts the headers of two alike projects side by side at the same height, in the sidebar order', () => {
  const a = team('a', [['po', 'po']])
  const b = team('b', [['po', 'po']])
  const { boxes } = layoutCanvas([a, b], board, insets)
  expect(boxes['project:a'].y).toBe(boxes['project:b'].y)
  expect(boxes['project:a'].x).toBeLessThan(boxes['project:b'].x)
})
it('fits 8 projects with 40 chats', () => {
  const eight = Array.from({ length: 8 }, (_, i) =>
    team(`p${i}`, [
      ['po', 'po', undefined, 1],
      ['plan', 'planejador', 'po'],
      ['e1', 'executor', 'plan'],
      ['e2', 'executor', 'plan'],
      ['e3', 'executor', 'po']
    ])
  )
  expect(Object.keys(layoutCanvas(eight, board, insets).boxes)).toHaveLength(48)
})

const zonesOf = (projects: CanvasProject[]): Map<string, CanvasZone> =>
  new Map(
    projects.flatMap((p) =>
      p.chats.map((c): [string, CanvasZone] => [c.key, isFreeChat(c) ? 'free' : 'tree'])
    )
  )
const shownByOldRule = (
  projects: CanvasProject[],
  viewport: { w: number; h: number },
  stored: CanvasOffsets
): Record<string, CanvasBox> =>
  applyCanvasOffsets(legacyAutoBoxes(projects, viewport), stored, zonesOf(projects))
const shownByNewRule = (
  projects: CanvasProject[],
  viewport: { w: number; h: number },
  stored: CanvasOffsets
): Record<string, CanvasBox> => {
  const zones = zonesOf(projects)
  const converted = convertLegacyPlacement(
    projects,
    legacyAutoBoxes(projects, viewport),
    stored,
    zones
  )
  const placed = anchoredPlacement(projects, converted.anchors, new Set(), { w: 2000, h: 1000 })
  return applyCanvasOffsets(placed.boxes, converted.offsets, zones, {
    parents: chatParents(projects),
    skipProjects: true
  })
}
it('turns the saved places of the previous version into anchors without moving any card (difference 0)', () => {
  const projects = [astra, orca1, so, social4]
  const stored: CanvasOffsets = {
    'project:social': { dx: 120, dy: -40 },
    'social-po': { dx: 120, dy: -40 },
    'social-plan': { dx: 300, dy: 210 },
    'astra-e1': { dx: -75, dy: 12 },
    'so-free': { dx: 10, dy: 20, zone: 'tree' }
  }
  const before = shownByOldRule(projects, board, stored)
  const after = shownByNewRule(projects, board, stored)
  for (const key of Object.keys(before)) {
    expect(after[key]).toEqual(before[key])
  }
})
it('keeps a chat born after its creator was dragged next to it, not at the automatic spot', () => {
  const base: Spec[] = [
    ['po', 'po'],
    ['plan', 'planejador', 'po']
  ]
  const grown = team('g', [...base, ['e1', 'executor', 'plan']])
  const small = team('g', base)
  const stored: CanvasOffsets = {
    'g-po': { dx: 900, dy: 700 },
    'g-plan': { dx: 900, dy: 700 },
    'project:g': { dx: 900, dy: 700 }
  }
  const converted = convertLegacyPlacement(
    [small],
    legacyAutoBoxes([small], board),
    stored,
    zonesOf([small])
  )
  const placed = anchoredPlacement([grown], converted.anchors, new Set(), { w: 2000, h: 1000 })
  const boxes = applyCanvasOffsets(placed.boxes, converted.offsets, zonesOf([grown]), {
    parents: chatParents([grown]),
    skipProjects: true
  })
  // Directly under its creator, on the next row, within 3 columns (3 x 392) edge to edge.
  expect(boxes['g-e1'].y - (boxes['g-plan'].y + 106)).toBe(80)
  expect(Math.abs(boxes['g-e1'].x - boxes['g-plan'].x)).toBeLessThanOrEqual(3 * 392)
  expect(effectiveOffset('g-e1', converted.offsets)).toBeUndefined()
})
it('pushes the neighbour by the least when a project grows into it, and the grower stays', () => {
  const left = team('left', [
    ['po', 'po'],
    ['e1', 'executor', 'po']
  ])
  const right = team('right', [['po', 'po']])
  const before = layoutCanvas([left, right], board, insets)
  const anchors = Object.fromEntries(
    Object.entries(before.headers).map(([id, h]) => [id, { ...h, sig: id }])
  )
  const wideLeft = team('left', [
    ['po', 'po'],
    ['e1', 'executor', 'po'],
    ['e2', 'executor', 'po'],
    ['e3', 'executor', 'po'],
    ['e4', 'executor', 'po']
  ])
  const resolved = anchoredPlacement([wideLeft, right], anchors, new Set(['left']), {
    w: 2000,
    h: 1000
  })
  expect(resolved.anchors.left.x).toBe(anchors.left.x)
  expect(resolved.anchors.left.y).toBe(anchors.left.y)
  expect(apart([wideLeft, right], resolved.boxes, wideLeft, right)).toBe(true)
  expect((resolved.anchors.right.x - anchors.right.x) % 196).toBe(0)
})
