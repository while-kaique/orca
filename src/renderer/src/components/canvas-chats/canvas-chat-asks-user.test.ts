import { describe, expect, it } from 'vitest'
import { replyAsksUser, turnEndedAskingUser } from './canvas-chat-asks-user'

// Endings copied from real chats (13/11/2026), labeled by hand.
describe('replyAsksUser', () => {
  it.each([
    'Plano de 5 versões pronto.\n\nAprova as 5 direções e o plano?',
    '**Deploy:** não se aplica.\n**Próxima ação:** responda "A" ou "B".',
    '**Próximo:** abra o print. Se preferir, diga "zera na primeira".',
    'Continuo esperando o seu "ok" para a `o-004`.',
    '**Próxima ação:** pare o node 26008, ou diga "pode parar" e eu paro.'
  ])('asks: %s', (reply) => {
    expect(replyAsksUser(reply)).toBe(true)
  })

  it.each([
    '**Próxima ação:** nenhuma sua; eu volto quando a folha chegar.',
    'Commit feito.\nVeja [Nano Banana Pro Has Gotten Dumber?](https://help.example.com/a?b=1)',
    'Oi, Kaique! Tudo bem?\nEm que posso te ajudar hoje?',
    'Próxima ação: quando o Arnaldo escolher uma D e uma E, me passe que eu aplico.',
    'Rodei `node x.mjs --help?` e passou.'
  ])('does not ask: %s', (reply) => {
    expect(replyAsksUser(reply)).toBe(false)
  })
})

describe('turnEndedAskingUser', () => {
  const ask = 'Aprova as 5 direções e o plano?'

  it('a turn held open only by a background command still asks', () => {
    const entry = {
      state: 'working' as const,
      workingMode: 'monitoring' as const,
      mainAgent: { state: 'done' as const, stateStartedAt: 1 },
      lastAssistantMessage: ask
    }
    expect(turnEndedAskingUser(entry as never, undefined)).toBe(true)
  })

  it('an orchestration worker asks its creator, never the user', () => {
    const entry = {
      state: 'done' as const,
      lastAssistantMessage: ask,
      orchestration: { taskId: 'task_1', dispatchId: 'ctx_1' }
    }
    expect(turnEndedAskingUser(entry as never, undefined)).toBe(false)
  })

  it('a turn still running does not ask yet', () => {
    expect(
      turnEndedAskingUser({ state: 'working', lastAssistantMessage: ask } as never, undefined)
    ).toBe(false)
  })
})
