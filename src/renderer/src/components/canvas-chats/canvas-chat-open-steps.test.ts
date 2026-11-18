import { expect, it } from 'vitest'
import { freeChatMaskDone, freeChatMaskView, type LaunchRecord } from './canvas-chat-launch-mask'
import { wakeMaskView } from './canvas-chat-wake-steps'

const record = (patch: Partial<LaunchRecord> = {}): LaunchRecord => ({
  kind: 'free',
  tabId: 't',
  worktreeId: 'w',
  since: 1_000,
  launchText: '',
  hadTerminal: false,
  sawWorking: false,
  runningSince: null,
  turnEndedAt: null,
  readyAt: null,
  problem: null,
  ...patch
})

it('wakes through the three steps as each signal arrives', () => {
  const none = { terminalAnswered: false, conversationLoaded: false, gaveUp: false }
  expect(wakeMaskView(none)).toEqual({ kind: 'steps', step: 1 })
  expect(wakeMaskView({ ...none, terminalAnswered: true })).toEqual({ kind: 'steps', step: 2 })
  expect(wakeMaskView({ ...none, terminalAnswered: true, conversationLoaded: true })).toEqual({
    kind: 'steps',
    step: 3
  })
})

it('a signal out of order does not light a later step before the earlier one', () => {
  expect(
    wakeMaskView({ terminalAnswered: false, conversationLoaded: true, gaveUp: false })
  ).toEqual({ kind: 'steps', step: 1 })
})

it('marks the step the wake stopped at when the terminal gave up', () => {
  expect(
    wakeMaskView({ terminalAnswered: false, conversationLoaded: false, gaveUp: true })
  ).toEqual({ kind: 'problem', step: 1, reason: 'terminal-gone' })
  expect(wakeMaskView({ terminalAnswered: true, conversationLoaded: false, gaveUp: true })).toEqual(
    { kind: 'problem', step: 2, reason: 'terminal-gone' }
  )
})

it('a free chat goes from terminal to Claude starting to ready', () => {
  const now = 5_000
  expect(freeChatMaskView(record(), { hasTerminal: false, claudeStarted: false, now })).toEqual({
    kind: 'steps',
    step: 1,
    askingPermission: false
  })
  expect(freeChatMaskView(record(), { hasTerminal: true, claudeStarted: false, now })).toEqual({
    kind: 'steps',
    step: 2,
    askingPermission: false
  })
  expect(freeChatMaskView(record(), { hasTerminal: true, claudeStarted: true, now })).toEqual({
    kind: 'steps',
    step: 3,
    askingPermission: false
  })
})

it('a free chat that never got its terminal or its Claude shows the step that stopped after 2 minutes', () => {
  const late = 1_000 + 120_001
  expect(
    freeChatMaskView(record(), { hasTerminal: false, claudeStarted: false, now: late })
  ).toEqual({ kind: 'problem', problem: { step: 1, reason: 'never-started' } })
  expect(
    freeChatMaskView(record(), { hasTerminal: true, claudeStarted: false, now: late })
  ).toEqual({ kind: 'problem', problem: { step: 2, reason: 'never-started' } })
})

it('a free chat whose terminal closed after opening is a problem at the step it was on', () => {
  expect(
    freeChatMaskView(record({ hadTerminal: true }), {
      hasTerminal: false,
      claudeStarted: false,
      now: 2_000
    })
  ).toEqual({ kind: 'problem', problem: { step: 1, reason: 'terminal' } })
})

it('the free chat screen leaves 2.5 seconds after Claude reported itself, not before', () => {
  expect(freeChatMaskDone(record(), 99_000)).toBe(false)
  expect(freeChatMaskDone(record({ readyAt: 10_000 }), 12_499)).toBe(false)
  expect(freeChatMaskDone(record({ readyAt: 10_000 }), 12_500)).toBe(true)
})
