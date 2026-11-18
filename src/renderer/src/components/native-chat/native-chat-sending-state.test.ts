import { expect, it } from 'vitest'
import { isNativeChatSending } from './native-chat-sending-state'

const NOW = 100_000

it('reads as sending while a fresh send waits for its turn to start', () => {
  expect(
    isNativeChatSending({ pending: [{ sentAt: NOW - 3_000 }], turnActive: false, now: NOW })
  ).toBe(true)
})

it('stops being sending once the turn is active', () => {
  expect(
    isNativeChatSending({ pending: [{ sentAt: NOW - 3_000 }], turnActive: true, now: NOW })
  ).toBe(false)
})

it('is not sending when the send failed, is uncertain, was recovered or is older than a minute', () => {
  const sentAt = NOW - 3_000
  expect(
    isNativeChatSending({
      pending: [{ sentAt, delivery: 'rejected' }],
      turnActive: false,
      now: NOW
    })
  ).toBe(false)
  expect(
    isNativeChatSending({
      pending: [{ sentAt, delivery: 'unconfirmed' }],
      turnActive: false,
      now: NOW
    })
  ).toBe(false)
  expect(
    isNativeChatSending({ pending: [{ sentAt, recovery: true }], turnActive: false, now: NOW })
  ).toBe(false)
  expect(
    isNativeChatSending({ pending: [{ sentAt: NOW - 60_000 }], turnActive: false, now: NOW })
  ).toBe(false)
})

it('is not sending with nothing pending', () => {
  expect(isNativeChatSending({ pending: [], turnActive: false, now: NOW })).toBe(false)
})
