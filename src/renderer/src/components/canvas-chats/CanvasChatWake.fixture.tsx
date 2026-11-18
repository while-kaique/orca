import { defineFixture } from '../../component-fixtures/component-fixture'
import { CanvasChatWakeMask } from './CanvasChatWakeMask'
import type { WakeFacts } from './canvas-chat-wake-steps'

/** Fork (o-052): the steps screen of an open card whose chat was asleep, at each step and when it gave up. */
const REASON = 'No preview available — open the workspace to view this agent.'

const frame = (facts: WakeFacts): ReturnType<typeof defineFixture> =>
  defineFixture({
    width: 560,
    render: () => (
      <div className="cc-board" style={{ background: 'transparent', padding: 16 }}>
        <div
          className="cc-node cc-chat cc-open"
          style={{ position: 'relative', width: 520, height: 340, left: 0, top: 0 }}
        >
          <CanvasChatWakeMask facts={facts} problemReason={REASON} />
        </div>
      </div>
    )
  })

const none: WakeFacts = { terminalAnswered: false, conversationLoaded: false, gaveUp: false }

export const abrindoTerminal = frame(none)
export const retomandoConversa = frame({ ...none, terminalAnswered: true })
export const claudePronto = frame({ ...none, terminalAnswered: true, conversationLoaded: true })
export const terminalDesistiu = frame({ ...none, gaveUp: true })
