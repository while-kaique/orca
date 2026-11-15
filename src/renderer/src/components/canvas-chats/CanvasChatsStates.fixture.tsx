import { defineFixture } from '../../component-fixtures/component-fixture'
import CanvasChatsPage from './CanvasChatsPage'
import { STATE_HIERARCHY, stateStore } from './canvas-chats-fixture-states'

/** Fork (o-044): card states computed by the real rule from host-shaped records, four projects side by side. */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const board = (): React.JSX.Element => (
  <div style={{ display: 'flex', height: 860 }}>
    <CanvasChatsPage />
  </div>
)

function setup(): void {
  window.api.repos.readCanvasHierarchy = () => Promise.resolve(STATE_HIERARCHY)
  window.api.repos.readCanvasContextTokens = () => Promise.resolve({})
  window.api.repos.readCanvasChatModels = () => Promise.resolve({})
}

async function tidy(frame: HTMLElement): Promise<void> {
  await wait(600)
  frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
  await wait(900)
}

/** The five cases (asks with a background command, seen, working, background only, team) and three projects. */
export const estados = defineFixture({
  width: 1280,
  store: stateStore(),
  setup,
  interact: tidy,
  render: board
})

/** The user answered: the asking chat runs a new turn and leaves "precisa de você". */
export const estadosRespondido = defineFixture({
  width: 1280,
  store: stateStore({ pede: 'working' }),
  setup,
  interact: tidy,
  render: board
})

/** A chat of the quiet project starts working: the project lights up. */
export const estadosArquivoAcende = defineFixture({
  width: 1280,
  store: stateStore({ arq1: 'working' }),
  setup,
  interact: tidy,
  render: board
})
