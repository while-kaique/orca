import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AppState } from '@/store/types'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import type { CanvasChatModels } from '../../../../shared/canvas-chat-transcript-model'
import type { CanvasContextTokens } from '../../../../shared/canvas-context-tokens'
import CanvasChatsPage from './CanvasChatsPage'
import { noteCanvasChatArtifacts } from './canvas-chat-artifacts'
import {
  SCENARIO_CONTEXT,
  SCENARIO_HIERARCHY,
  SCENARIO_MODELS,
  SCENARIO_STORE,
  SCENARIO_TERMINAL_TEXT,
  scenarioHierarchyWithParents,
  scenarioPicture,
  scenarioStoreWithStates
} from './canvas-chats-fixture-scenario'

/**
 * Fork: the flowchart drawn from a copy of the real app state, so layout and colors can be checked
 * without restarting Orca. `python tools/vistoria-fluxograma/capturar.py` writes the copy (kept out
 * of git: it carries chat text); `pnpm fixtures:shot canvas-chats/CanvasChatsPage:real` draws it.
 */
type Capture = {
  store: Partial<AppState>
  hierarchy: CanvasHierarchySnapshot[]
  contextTokens: CanvasContextTokens
  chatModels?: CanvasChatModels
}

function isCapture(value: unknown): value is Capture {
  return typeof value === 'object' && value !== null && 'store' in value && 'hierarchy' in value
}

// The shot is clipped to a 1280x900 viewport: the board has to fit inside it.
const BOARD_HEIGHT = 860
const captures = import.meta.glob('../../../../../.cache/vistoria-fluxograma/estado.json', {
  eager: true,
  import: 'default'
})
const found = Object.values(captures).find(isCapture)
const capture: Capture = found ?? { store: {}, hierarchy: [], contextTokens: {} }

/** Pages and image files are not reachable from a fixture: a flat picture stands in for each. */
function stubPictures(): void {
  window.api.repos.captureCanvasPagePreview = (url) =>
    Promise.resolve({ kind: 'ok', dataUrl: scenarioPicture(url) })
  window.api.repos.readCanvasImage = ({ path }) =>
    Promise.resolve({ kind: 'ok', dataUrl: scenarioPicture(path) })
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const board = (): React.JSX.Element => (
  <div style={{ display: 'flex', height: BOARD_HEIGHT }}>
    <CanvasChatsPage />
  </div>
)

function scenarioSetupWith(hierarchy: typeof SCENARIO_HIERARCHY): void {
  window.api.repos.readCanvasHierarchy = () => Promise.resolve(hierarchy)
  window.api.repos.readCanvasContextTokens = () => Promise.resolve(SCENARIO_CONTEXT)
  window.api.repos.readCanvasChatModels = () => Promise.resolve(SCENARIO_MODELS)
  stubPictures()
  for (const [tab, text] of Object.entries(SCENARIO_TERMINAL_TEXT)) {
    noteCanvasChatArtifacts(tab, text)
  }
}

const scenarioSetup = (): void => scenarioSetupWith(SCENARIO_HIERARCHY)

/** The full hierarchy (PO, two planners, four executors) with every kind of attachment. */
export const exemplo = defineFixture({
  width: 1280,
  store: SCENARIO_STORE,
  setup: scenarioSetup,
  interact: async (frame) => {
    await wait(400)
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
  },
  render: board
})

/** Same board with the PO's image gallery open. */
export const exemploGaleria = defineFixture({
  width: 1280,
  store: SCENARIO_STORE,
  setup: scenarioSetup,
  interact: async (frame) => {
    await wait(400)
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
    frame.querySelector<HTMLButtonElement>(".cc-chip[data-kind='image']")?.click()
    await wait(500)
  },
  render: board
})

/** Every border state at once. The states are written straight on the cards: a fixture has no live agents to report them. */
export const exemploEstados = defineFixture({
  width: 1280,
  store: SCENARIO_STORE,
  setup: scenarioSetup,
  interact: async (frame) => {
    await wait(400)
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
    const states: Record<string, string> = {
      po: 'team',
      pl1: 'working',
      pl2: 'seen',
      ex1: 'team',
      ex2: 'unseen',
      ex3: 'waiting',
      ex4: 'monitoring'
    }
    for (const [key, state] of Object.entries(states)) {
      frame.querySelector(`[data-chat-key="${key}"]`)?.setAttribute('data-status', state)
    }
    await wait(200)
  },
  render: board
})

const ALL_DONE = {
  po: 'done',
  pl1: 'done',
  pl2: 'done',
  ex1: 'done',
  ex2: 'done',
  ex3: 'done',
  ex4: 'done'
} as const
const TEAM_PARENTS = { ex1: 'po' }

async function tidyBoard(frame: HTMLElement): Promise<void> {
  await wait(400)
  frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
  await wait(700)
}

/** The PO created an executor straight, and it is working: the PO waits on its team. */
export const equipePo = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates({ ...ALL_DONE, ex1: 'working' }),
  setup: () => scenarioSetupWith(scenarioHierarchyWithParents(TEAM_PARENTS)),
  interact: tidyBoard,
  render: board
})

/** Planner 1's two executors work: the planner and the PO above it wait on the team. */
export const equipePlanejador = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates({ ...ALL_DONE, ex1: 'working', ex2: 'working' }),
  setup: scenarioSetup,
  interact: tidyBoard,
  render: board
})

/** Same board with every executor stopped: nobody waits on a team. */
export const equipeParada = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates(ALL_DONE),
  setup: scenarioSetup,
  interact: tidyBoard,
  render: board
})

/** The PO opened: the head carries the open-in-normal-view button and the X. */
export const exemploAberto = defineFixture({
  width: 1280,
  store: SCENARIO_STORE,
  setup: scenarioSetup,
  interact: async (frame) => {
    await wait(400)
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
    frame.querySelector<HTMLElement>('[data-chat-key="po"]')?.click()
    await wait(1200)
  },
  render: board
})

/** The open PO after its X was clicked: the close confirmation covers the card. */
export const exemploFechar = defineFixture({
  width: 1280,
  store: SCENARIO_STORE,
  setup: scenarioSetup,
  interact: async (frame) => {
    await wait(400)
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
    frame.querySelector<HTMLElement>('[data-chat-key="po"]')?.click()
    await wait(1200)
    frame.querySelector<HTMLButtonElement>('.cc-head-close')?.click()
    await wait(300)
  },
  render: board
})

/** The mouse resting on the PO: the peek grows and its X sits at the card's corner. */
export const exemploEspiar = defineFixture({
  width: 1280,
  store: SCENARIO_STORE,
  setup: scenarioSetup,
  interact: async (frame) => {
    await wait(400)
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
    const card = frame.querySelector<HTMLElement>('[data-chat-key="po"]')
    card?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
    card?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await wait(900)
    card?.querySelector<HTMLElement>('.cc-xbtn')?.setAttribute('style', 'opacity:1;transform:none')
    await wait(100)
  },
  render: board
})

export const real = defineFixture({
  width: 1280,
  store: capture.store,
  setup: () => {
    window.api.repos.readCanvasHierarchy = () => Promise.resolve(capture.hierarchy)
    window.api.repos.readCanvasContextTokens = () => Promise.resolve(capture.contextTokens)
    window.api.repos.readCanvasChatModels = () => Promise.resolve(capture.chatModels ?? {})
    stubPictures()
  },
  // The first fit can run before the board is measured; Reorganizar fits everything in view.
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await wait(700)
  },
  render: board
})
