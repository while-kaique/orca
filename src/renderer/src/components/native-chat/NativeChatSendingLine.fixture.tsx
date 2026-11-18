import { defineFixture } from '../../component-fixtures/component-fixture'
import { NativeChatTurnActivityLine } from './NativeChatTurnActivityLine'

/** Fork (o-052): the live tail line between the send and the turn starting ("Enviando…") and once it started. */
const line = (activityText: string | null): ReturnType<typeof defineFixture> =>
  defineFixture({
    width: 420,
    render: () => (
      <div className="p-4">
        <NativeChatTurnActivityLine
          line={{ thinking: false, stopping: false, activityText, reasoning: null }}
        />
      </div>
    )
  })

export const enviando = line('Enviando…')
export const trabalhando = line(null)
