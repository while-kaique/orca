import { expect, it } from 'vitest'
import { canvasChatModelLabel } from './canvas-chat-model-label'

it('turns a Claude model id into the short name shown on the card', () => {
  expect(canvasChatModelLabel('claude-fable-5-2')).toEqual({ family: 'fable', label: 'Fable 5.2' })
  expect(canvasChatModelLabel('claude-sonnet-5-5')).toEqual({
    family: 'sonnet',
    label: 'Sonnet 5.5'
  })
  expect(canvasChatModelLabel('opus')).toEqual({ family: 'opus', label: 'Opus' })
  expect(canvasChatModelLabel('claude-opus-4-20250514')).toEqual({
    family: 'opus',
    label: 'Opus 4'
  })
})
it('shows an unknown model as it is and nothing when there is no model', () => {
  expect(canvasChatModelLabel('gpt-6-astra')).toEqual({ family: 'other', label: 'gpt-6-astra' })
  expect(canvasChatModelLabel('  ')).toBeNull()
  expect(canvasChatModelLabel(null)).toBeNull()
})
