import { useRef } from 'react'
import type React from 'react'
import { useFitText } from './canvas-chat-fit-text'
import { CanvasChatContextMeter } from './CanvasChatContextMeter'
import { CanvasChatModel, CanvasChatRole } from './CanvasChatHierarchyBadges'
import type { CanvasChat } from './canvas-chats-layout'
import { EXECUTOR_CREST, EXECUTOR_CREST_SCALE } from './canvas-chat-shape'

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
  const nameRef = useRef<HTMLElement>(null)
  // Two lines inside the hexagon; smaller letters when a long word or a third line would not fit.
  useFitText(nameRef, name, 2, '')
  return (
    // Drawn at full size and scaled as a whole, so text and meter shrink with the outline.
    <div
      className="cc-crest-body"
      style={{ width: w, height: h, transform: `scale(${EXECUTOR_CREST_SCALE})` }}
    >
      <svg className="cc-crest-outline" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <polygon points={OUTLINE} />
      </svg>
      <CanvasChatRole chat={chat} />
      <b ref={nameRef}>{name}</b>
      <CanvasChatModel chat={chat} />
      <CanvasChatContextMeter transcriptPath={chat.transcriptPath} />
    </div>
  )
}
