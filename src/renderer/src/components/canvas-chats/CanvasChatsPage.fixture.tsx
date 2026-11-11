import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AppState } from '@/store/types'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import type { CanvasContextTokens } from '../../../../shared/canvas-context-tokens'
import CanvasChatsPage from './CanvasChatsPage'

/**
 * Fork: the flowchart drawn from a copy of the real app state, so layout and colors can be checked
 * without restarting Orca. `python tools/vistoria-fluxograma/capturar.py` writes the copy (kept out
 * of git: it carries chat text); `pnpm fixtures:shot canvas-chats/CanvasChatsPage:real` draws it.
 */
type Capture = {
  store: Partial<AppState>
  hierarchy: CanvasHierarchySnapshot[]
  contextTokens: CanvasContextTokens
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

export const real = defineFixture({
  width: 1280,
  store: capture.store,
  setup: () => {
    window.api.repos.readCanvasHierarchy = () => Promise.resolve(capture.hierarchy)
    window.api.repos.readCanvasContextTokens = () => Promise.resolve(capture.contextTokens)
  },
  // The first fit can run before the board is measured; Reorganizar fits everything in view.
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
    await new Promise((resolve) => setTimeout(resolve, 700))
  },
  render: () => (
    <div style={{ display: 'flex', height: BOARD_HEIGHT }}>
      <CanvasChatsPage />
    </div>
  )
})
