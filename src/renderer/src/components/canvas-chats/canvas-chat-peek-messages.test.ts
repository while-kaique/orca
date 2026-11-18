import { expect, it } from 'vitest'
import { clipPeekPrompt, clipPeekReply, peekMessages } from './canvas-chat-peek-messages'

it('keeps a short reply whole and drops code fence lines but not the code', () => {
  expect(clipPeekReply('Feito.\n\n```ts\nconst a = 1\n```\n\nSegue o **resultado**.')).toBe(
    'Feito.\n\nconst a = 1\n\nSegue o **resultado**.'
  )
})

it('cuts a long reply at the 14th line and ends with an ellipsis', () => {
  const reply = Array.from({ length: 30 }, (_, i) => `- item ${i + 1}`).join('\n')
  const out = clipPeekReply(reply) ?? ''
  expect(out.split('\n')).toHaveLength(14)
  expect(out.endsWith('- item 14…')).toBe(true)
})

it('cuts a long paragraph at a word, within 700 characters, with an ellipsis', () => {
  const out = clipPeekReply('palavra '.repeat(200)) ?? ''
  expect(out.endsWith('palavra…')).toBe(true)
  expect(out).toHaveLength(696)
})

it('prefers to cut a long reply at the end of a sentence', () => {
  const sentence = 'Esta frase termina logo aqui. '
  const out = clipPeekReply(sentence.repeat(30)) ?? ''
  expect(out.endsWith('aqui…')).toBe(true)
  expect(out).toHaveLength(689)
})

it('never leaves bold or inline code open at the cut', () => {
  const line = `${'a '.repeat(345)}**negrito que não fecha e continua`
  expect(clipPeekReply(line)?.includes('**')).toBe(false)
  expect(clipPeekReply(`${'b '.repeat(345)}\`codigo aberto`)?.includes('`')).toBe(false)
})

it('shortens the prompt to one line of 180 characters at most', () => {
  expect(clipPeekPrompt('  faz   isso\n\n e aquilo ')).toBe('faz isso e aquilo')
  const out = clipPeekPrompt('palavra '.repeat(50)) ?? ''
  expect(out.endsWith('palavra…')).toBe(true)
  expect(out.length).toBeLessThanOrEqual(181)
})

it('says there is nothing for a chat with no messages', () => {
  expect(peekMessages(undefined, '  \n ')).toEqual({ prompt: null, reply: null })
  expect(peekMessages('oi', 'olá')).toEqual({ prompt: 'oi', reply: 'olá' })
})
