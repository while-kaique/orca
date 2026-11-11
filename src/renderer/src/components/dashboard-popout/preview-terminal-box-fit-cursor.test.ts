// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPreviewBoxFit } from './preview-terminal-box-fit'

const frames: FrameRequestCallback[] = []

beforeEach(() => {
  frames.length = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function flush(): void {
  for (const callback of frames.splice(0)) {
    callback(16)
  }
}

function harness() {
  const box = document.createElement('div')
  const container = document.createElement('div')
  const screen = document.createElement('div')
  screen.className = 'xterm-screen'
  box.append(container)
  container.append(screen)
  Object.defineProperties(box, { clientWidth: { value: 600 }, clientHeight: { value: 240 } })
  const widthReads = vi.fn(() => 800)
  Object.defineProperty(screen, 'offsetWidth', { get: widthReads })
  Object.defineProperty(screen, 'offsetHeight', { value: 384 })
  const terminal = { rows: 24, buffer: { active: { cursorY: 0 } } }
  const owner = createPreviewBoxFit({
    container,
    getTerminal: () => terminal as never
  })
  return { owner, box, container, terminal, widthReads }
}

it('re-anchors after writes from cached geometry without measuring layout again', () => {
  const { owner, box, container, terminal, widthReads } = harness()
  owner.schedule()
  flush()
  expect(widthReads).toHaveBeenCalledOnce()
  expect(box.style.alignItems).toBe('flex-start')

  // 24 rows * 16 px * 0.75 = 288 px > 240 px box: cursor on the last row anchors to the bottom.
  terminal.buffer.active.cursorY = 23
  owner.scheduleAfterWrite()
  flush()
  expect(widthReads).toHaveBeenCalledOnce()
  expect(box.style.alignItems).toBe('flex-end')
  expect(container.style.transformOrigin).toBe('bottom left')
})

it('measures again when the grid changes or a full fit is pending', () => {
  const { owner, terminal, widthReads } = harness()
  owner.scheduleAfterWrite()
  flush()
  expect(widthReads).toHaveBeenCalledTimes(1)

  terminal.rows = 30
  owner.scheduleAfterWrite()
  flush()
  expect(widthReads).toHaveBeenCalledTimes(2)

  owner.scheduleAfterWrite()
  owner.schedule()
  expect(frames).toHaveLength(1)
  flush()
  expect(widthReads).toHaveBeenCalledTimes(3)
})
