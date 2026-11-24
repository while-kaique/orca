import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../native-chat-types'
import {
  pendingSendsAsMessages,
  prunePendingSends,
  type NativeChatPendingSend
} from './native-chat-pending-sends'

function userMessage(id: string, text: string, timestamp = 1): NativeChatMessage {
  return {
    id,
    role: 'user',
    blocks: [{ type: 'text', text }],
    timestamp,
    source: 'transcript'
  }
}

function assistantMessage(id: string, text: string, timestamp = 2): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [{ type: 'text', text }],
    timestamp,
    source: 'transcript'
  }
}

const pendingOf = (id: string, text: string): NativeChatPendingSend => ({ id, text, sentAt: 100 })

// Glue fixtures place rows after sentAt; older matching rows must never retire newer sends.
const GLUE_BOUNDARY = assistantMessage('glue-boundary', 'ready', 1000)
const GLUE_SENT_AT = 5000

function gluePending(id: string, text: string): NativeChatPendingSend {
  return {
    id,
    text,
    sentAt: GLUE_SENT_AT,
    afterMessageId: GLUE_BOUNDARY.id,
    afterMessageTimestamp: GLUE_BOUNDARY.timestamp
  }
}

describe('glued rapid sends', () => {
  // Every send carries its own boundary, including later sends in a glued row.
  const mixedAgeGlue = (): { messages: NativeChatMessage[]; pending: NativeChatPendingSend[] } => {
    const gluedRow = userMessage('glue-row', 'fix the bug', 6000)
    return {
      messages: [
        GLUE_BOUNDARY,
        gluedRow,
        assistantMessage('glue-answer', 'fixed', 6100),
        userMessage('later-history', 'anything', 6200)
      ],
      pending: [
        gluePending('p1', 'fix the'),
        {
          id: 'p2',
          text: 'bug',
          sentAt: 7000,
          afterMessageId: 'glue-answer',
          afterMessageTimestamp: 6100
        }
      ]
    }
  }

  it('keeps a queued send whose own boundary is newer than the glued row (STA-4477)', () => {
    const { messages, pending } = mixedAgeGlue()

    expect(prunePendingSends(pending, messages)).toEqual(pending)
  })

  // Keep prune and render assertions separate so one failure cannot mask the other regression.
  it('still renders a queued send whose own boundary is newer than the row (STA-4477)', () => {
    const { messages, pending } = mixedAgeGlue()

    expect(pendingSendsAsMessages(pending, messages)).toHaveLength(2)
  })

  it('never glues across a send the row cannot represent (STA-4477)', () => {
    const gluedRow = userMessage('glue-row', 'alpha gamma', 6000)
    const messages = [GLUE_BOUNDARY, gluedRow, assistantMessage('glue-answer', 'ok', 6100)]
    const pending = [
      gluePending('p1', 'alpha'),
      {
        id: 'p2',
        text: 'beta',
        sentAt: 7000,
        afterMessageId: 'glue-row',
        afterMessageTimestamp: 6000
      },
      gluePending('p3', 'gamma')
    ]

    expect(prunePendingSends(pending, messages)).toEqual(pending)
    expect(pendingSendsAsMessages(pending, messages)).toHaveLength(3)
  })

  it('still retires the leading run the glued row did land after (STA-4477)', () => {
    const gluedRow = userMessage('glue-row', 'first second', 6000)
    const messages = [GLUE_BOUNDARY, gluedRow, assistantMessage('glue-answer', 'done', 6100)]
    const third = {
      id: 'p3',
      text: 'third',
      sentAt: 7000,
      afterMessageId: 'glue-row',
      afterMessageTimestamp: gluedRow.timestamp
    }
    const pending = [gluePending('p1', 'first'), gluePending('p2', 'second'), third]

    expect(prunePendingSends(pending, messages)).toEqual([third])
  })
})

describe('pendingSendsAsMessages', () => {
  // Empty-transcript sends cannot compare row boundaries or assume host/client clock alignment (#11519).
  it('retires a send into a settled empty transcript whatever the host clock says', () => {
    const fiveMinutes = 5 * 60_000
    const pending = [
      {
        ...pendingOf('first-send', 'run tests'),
        sentAt: 1_000_000,
        afterMessageId: null,
        afterEmptyTranscriptSessionId: 'session-1'
      }
    ]
    const hostBehind = [
      { ...userMessage('u1', 'run tests'), timestamp: 1_000_000 - fiveMinutes },
      { ...assistantMessage('a1', 'passed'), timestamp: 1_000_000 - fiveMinutes + 10 }
    ]

    expect(pendingSendsAsMessages(pending, hostBehind)).toEqual([])
    expect(prunePendingSends(pending, hostBehind)).toEqual([])
  })

  it('uses the transcript boundary clock after pagination, not the renderer send clock', () => {
    const pending = [
      {
        ...pendingOf('new-send', 'run tests'),
        sentAt: 100_000,
        afterMessageId: 'paged-out-answer',
        afterMessageTimestamp: 20
      }
    ]
    const remoteTranscript = [
      { ...userMessage('new-user', 'run tests'), timestamp: 30 },
      { ...assistantMessage('new-answer', 'passed'), timestamp: 40 }
    ]

    expect(pendingSendsAsMessages(pending, remoteTranscript)).toEqual([])
    expect(prunePendingSends(pending, remoteTranscript)).toEqual([])
  })
})

describe('image-only sends that land with text', () => {
  it('retires the echo once its pasted image arrives with text typed on the terminal', () => {
    const path = 'C:\\Users\\me\\pastes\\orca-paste-1.png'
    const pending: NativeChatPendingSend[] = [
      { id: 'p', text: '', imagePaths: [path], sentAt: 100 }
    ]
    const landed: NativeChatMessage[] = [
      {
        id: 'u',
        role: 'user',
        blocks: [
          { type: 'image-ref', path },
          { type: 'text', text: 'is this right?' }
        ],
        timestamp: 200,
        source: 'transcript'
      },
      assistantMessage('a', 'Yes.', 300)
    ]

    expect(pendingSendsAsMessages(pending, landed)).toEqual([])
    expect(prunePendingSends(pending, landed)).toEqual([])
  })

  it('retires the echo of an image sent mid-turn, which lands as a bare marker without its file', () => {
    const pending: NativeChatPendingSend[] = [
      { id: 'p', text: '', imagePaths: ['C:/pastes/orca-paste-2.png'], sentAt: 100 }
    ]
    const landed: NativeChatMessage[] = [
      userMessage('u', '[Image #15]', 200),
      assistantMessage('a', 'Got it.', 300)
    ]

    expect(pendingSendsAsMessages(pending, landed)).toEqual([])
    expect(prunePendingSends(pending, landed)).toEqual([])
  })
})

describe('sends that never reached the session', () => {
  const lost = (): NativeChatPendingSend => ({
    id: 'lost',
    text: 'think of a way to always get 4:1',
    sentAt: 100,
    afterMessageId: 'before',
    afterMessageTimestamp: 50
  })

  it('keeps waiting while only one later prompt has been answered', () => {
    const messages = [
      assistantMessage('before', 'done', 50),
      userMessage('u1', 'I liked this one', 200),
      assistantMessage('a1', 'Great.', 300)
    ]

    expect(prunePendingSends([lost()], messages)).toHaveLength(1)
  })

  it('drops the echo once two later prompts were answered without it', () => {
    const messages = [
      assistantMessage('before', 'done', 50),
      userMessage('u1', 'I liked this one', 200),
      assistantMessage('a1', 'Great.', 300),
      userMessage('notice', '<task-notification>done</task-notification>', 350),
      assistantMessage('a2', 'Noted.', 360),
      userMessage('u2', 'and now?', 400),
      assistantMessage('a3', 'Here it is.', 500)
    ]

    expect(prunePendingSends([lost()], messages)).toEqual([])
  })
})

describe('shell commands sent with !', () => {
  it('hides the echo once Claude records the command it ran', () => {
    const pending: NativeChatPendingSend[] = [pendingOf('p', '! ls -la')]
    const landed = [userMessage('u', '<bash-input>ls -la</bash-input>', 200)]

    expect(pendingSendsAsMessages(pending, landed)).toEqual([])
  })
})
