import { expect, it } from 'vitest'
import { modelFromTranscriptTail } from './canvas-chat-transcript-model'

const reply = (model: string): string =>
  JSON.stringify({
    isSidechain: false,
    type: 'assistant',
    message: { model, role: 'assistant', content: [{ type: 'text', text: 'oi' }] }
  })

// Same shape Claude Code writes when a request leaves (seen in a real transcript, 18/11/2026), minus the payload.
const request = (model: string, querySource = 'repl_main_thread'): string =>
  JSON.stringify({
    type: 'api-request',
    sessionId: 'sessao-de-teste',
    timestamp: '2026-11-18T12:35:26.439Z',
    version: '2.1.327',
    querySource,
    params: { model, betas: ['claude-code-20250219'] }
  })

it('reads the new model from the request that left after a switch on the chat screen, before any reply', () => {
  const tail = [reply('claude-fable-5-2'), request('claude-opus-5-5')].join('\n')
  expect(modelFromTranscriptTail(tail)).toBe('claude-opus-5-5')
})

it('ignores requests that are not the chat main thread', () => {
  const tail = [reply('claude-fable-5-2'), request('claude-haiku-5-5', 'agent:subagent')].join('\n')
  expect(modelFromTranscriptTail(tail)).toBe('claude-fable-5-2')
})
