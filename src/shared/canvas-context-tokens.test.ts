import { expect, it } from 'vitest'
import { contextTokensFromTranscriptTail } from './canvas-context-tokens'

const reply = (usage: Record<string, number>, extra = ''): string =>
  `{"type":"assistant"${extra},"message":{"role":"assistant","usage":${JSON.stringify(usage)}}}`

it('adds what the last reply read and wrote', () => {
  const tail = [
    reply({ input_tokens: 10, cache_read_input_tokens: 1000, output_tokens: 5 }),
    '{"type":"user","message":{"role":"user","content":"oi"}}',
    reply({
      input_tokens: 3,
      cache_read_input_tokens: 350_000,
      cache_creation_input_tokens: 2_000,
      output_tokens: 400
    })
  ].join('\n')
  expect(contextTokensFromTranscriptTail(tail)).toBe(352_403)
})
it('skips subagent replies and a line cut in half', () => {
  const tail = [
    'ns":999999}}}',
    reply({ input_tokens: 100, cache_read_input_tokens: 40_000, output_tokens: 20 }),
    reply({ input_tokens: 7, cache_read_input_tokens: 9_000 }, ',"isSidechain":true')
  ].join('\n')
  expect(contextTokensFromTranscriptTail(tail)).toBe(40_120)
})
it('says nothing when no reply was recorded yet', () => {
  expect(contextTokensFromTranscriptTail('{"type":"user","message":{"content":"oi"}}')).toBeNull()
})
