import { describe, expect, it } from 'vitest'
import { resolveDefaultNativeChatViewMode } from './native-chat-default-view-mode'

describe('resolveDefaultNativeChatViewMode', () => {
  it('opens a Claude tab with no saved choice in chat', () => {
    expect(
      resolveDefaultNativeChatViewMode({
        savedViewMode: undefined,
        agent: 'claude',
        chatAvailable: true
      })
    ).toBe('chat')
  })

  it('keeps the terminal when the user chose it for the tab', () => {
    expect(
      resolveDefaultNativeChatViewMode({
        savedViewMode: 'terminal',
        agent: 'claude',
        chatAvailable: true
      })
    ).toBe('terminal')
  })

  it('keeps chat when the user chose it, even if chat looks unavailable', () => {
    expect(
      resolveDefaultNativeChatViewMode({
        savedViewMode: 'chat',
        agent: null,
        chatAvailable: false
      })
    ).toBe('chat')
  })

  it('leaves a plain shell and other agents in the terminal', () => {
    expect(
      resolveDefaultNativeChatViewMode({
        savedViewMode: undefined,
        agent: null,
        chatAvailable: false
      })
    ).toBe('terminal')
    expect(
      resolveDefaultNativeChatViewMode({
        savedViewMode: undefined,
        agent: 'codex',
        chatAvailable: true
      })
    ).toBe('terminal')
  })

  it('stays in the terminal while chat is not available yet', () => {
    expect(
      resolveDefaultNativeChatViewMode({
        savedViewMode: undefined,
        agent: 'claude',
        chatAvailable: false
      })
    ).toBe('terminal')
  })
})
