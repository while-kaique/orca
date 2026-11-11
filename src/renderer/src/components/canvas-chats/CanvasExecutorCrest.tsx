import type React from 'react'
import { CanvasChatContextMeter } from './CanvasChatContextMeter'
import type { CanvasChat } from './canvas-chats-layout'
import { EXECUTOR_CREST } from './canvas-chat-shape'

const { w, h } = EXECUTOR_CREST
const INSET = 3
const SHOULDER = h * 0.25
const OUTLINE = [
  [w / 2, INSET],
  [w - INSET, SHOULDER],
  [w - INSET, h - SHOULDER],
  [w / 2, h - INSET],
  [INSET, h - SHOULDER],
  [INSET, SHOULDER]
]
  .map((point) => point.join(','))
  .join(' ')

/** Fork: an executor's closed card: a hexagon with its job title and how full its context is. */
export function CanvasExecutorCrest({
  chat,
  name
}: {
  chat: CanvasChat
  name: string
}): React.JSX.Element {
  return (
    <div className="cc-crest-body">
      <svg className="cc-crest-outline" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <polygon points={OUTLINE} />
      </svg>
      <b>{name}</b>
      <CanvasChatContextMeter transcriptPath={chat.transcriptPath} />
    </div>
  )
}
