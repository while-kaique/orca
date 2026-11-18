import { expect, it } from 'vitest'
import { resolveCardModel } from './canvas-chat-model-choice'

const FABLE = 'claude-fable-5-2'

it('shows the model just picked on the chat screen before the transcript says anything new', () => {
  expect(
    resolveCardModel({
      choice: { value: 'opus', at: 2000 },
      transcriptModel: FABLE,
      transcriptChangedAt: 1000,
      statusModel: null
    })
  ).toBe('opus')
})

it('goes back to the transcript once it names a model after the pick', () => {
  expect(
    resolveCardModel({
      choice: { value: 'opus', at: 2000 },
      transcriptModel: 'claude-opus-5-5',
      transcriptChangedAt: 3000,
      statusModel: null
    })
  ).toBe('claude-opus-5-5')
  expect(
    resolveCardModel({
      choice: { value: 'opus', at: 2000 },
      transcriptModel: 'claude-sonnet-5-5',
      transcriptChangedAt: 3000,
      statusModel: null
    })
  ).toBe('claude-sonnet-5-5')
})

it('keeps the exact transcript name when the pick is the same family', () => {
  expect(
    resolveCardModel({
      choice: { value: 'opus', at: 2000 },
      transcriptModel: 'claude-opus-5-5',
      transcriptChangedAt: 1000,
      statusModel: null
    })
  ).toBe('claude-opus-5-5')
})

it('uses the pick for a chat whose transcript has no model yet, and the status model with no pick', () => {
  expect(
    resolveCardModel({
      choice: { value: 'sonnet', at: 5 },
      transcriptModel: null,
      transcriptChangedAt: 0,
      statusModel: FABLE
    })
  ).toBe('sonnet')
  expect(
    resolveCardModel({
      choice: null,
      transcriptModel: null,
      transcriptChangedAt: 0,
      statusModel: FABLE
    })
  ).toBe(FABLE)
})
