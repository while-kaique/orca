import { useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { CanvasBox } from './canvas-chats-layout'
import {
  addCanvasCord,
  cordPath,
  hasCanvasCord,
  removeCanvasCord,
  sidePath,
  useCanvasCords
} from './canvas-chats-cords'

type LinkDrag = { from: string; point: { x: number; y: number }; target: string | null }

/** Fork: hand-drawn cords — pull from a card edge, snap blue on a valid chat, X in the middle cuts. */
export function useCanvasCordLayer({
  boxes,
  view,
  rootRef
}: {
  boxes: Readonly<Record<string, CanvasBox>>
  view: { x: number; y: number; s: number }
  rootRef: React.RefObject<HTMLDivElement | null>
}): {
  linkDrag: LinkDrag | null
  startLink: (fromKey: string, e: React.PointerEvent) => void
  paths: React.JSX.Element[]
  cutButton: React.JSX.Element | null
} {
  const cords = useCanvasCords()
  const [linkDrag, setLinkDrag] = useState<LinkDrag | null>(null)
  const [hoverCord, setHoverCord] = useState<string | null>(null)
  const cutTimerRef = useRef(0)
  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = rootRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left - view.x) / view.s, y: (clientY - rect.top - view.y) / view.s }
  }
  const startLink = (fromKey: string, e: React.PointerEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    const move = (ev: PointerEvent): void => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const key = (el?.closest('[data-chat-key]') as HTMLElement | null)?.dataset.chatKey ?? null
      const target = key && key !== fromKey && !hasCanvasCord(fromKey, key) ? key : null
      setLinkDrag({ from: fromKey, point: toWorld(ev.clientX, ev.clientY), target })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLinkDrag((drag) => {
        if (drag?.target) {
          addCanvasCord(drag.from, drag.target)
        }
        return null
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    move(e.nativeEvent)
  }
  const showCut = (key: string): void => {
    clearTimeout(cutTimerRef.current)
    setHoverCord(key)
  }
  const hideCut = (): void => {
    clearTimeout(cutTimerRef.current)
    cutTimerRef.current = window.setTimeout(() => setHoverCord(null), 300)
  }
  const paths: React.JSX.Element[] = []
  let cutAt: { key: string; a: string; b: string; x: number; y: number } | null = null
  for (const cord of cords) {
    const ab = boxes[cord.a]
    const bb = boxes[cord.b]
    if (!ab || !bb) {
      continue
    }
    const key = `${cord.a}~${cord.b}`
    const { d, mid } = cordPath(ab, bb)
    paths.push(
      <path key={key} className={`cc-cord${hoverCord === key ? ' cc-cord-hot' : ''}`} d={d} />,
      <path
        key={`${key}-hit`}
        className="cc-cord-hit"
        d={d}
        style={{ strokeWidth: 26 / view.s }}
        onPointerEnter={() => showCut(key)}
        onPointerLeave={hideCut}
      />
    )
    if (hoverCord === key) {
      cutAt = { key, a: cord.a, b: cord.b, x: mid.x, y: mid.y }
    }
  }
  if (linkDrag) {
    const from = boxes[linkDrag.from]
    const to = linkDrag.target ? boxes[linkDrag.target] : null
    if (from) {
      const d = to
        ? cordPath(from, to).d
        : sidePath({ x: from.x + from.w, y: from.y + from.h / 2 }, linkDrag.point).d
      paths.push(
        <path key="cc-tmp" className={`cc-cord-tmp${linkDrag.target ? ' cc-cord-ok' : ''}`} d={d} />
      )
    }
  }

  const cutButton = cutAt ? (
    <button
      type="button"
      className="cc-cut"
      style={{ left: cutAt.x, top: cutAt.y }}
      title={translate('fork.canvas.cutCord', 'Cortar a corda')}
      onPointerEnter={() => showCut(cutAt!.key)}
      onPointerLeave={hideCut}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => {
        removeCanvasCord(cutAt!.a, cutAt!.b)
        setHoverCord(null)
      }}
    >
      ✕
    </button>
  ) : null
  return { linkDrag, startLink, paths, cutButton }
}
