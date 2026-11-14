import { useLayoutEffect, type RefObject } from 'react'

/** Smallest the letters get before the text simply wraps onto more lines. */
const MIN_FONT_PX = 10.5
const FONT_STEP_PX = 0.5

function lineCount(el: HTMLElement): number {
  const range = document.createRange()
  range.selectNodeContents(el)
  return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
}

/**
 * Keeps a name inside its card: at most `maxLines` lines, no word wider than the box and, when `card` is given,
 * nothing spilling out of the card's height. When that does not hold the letters shrink step by step; the text is
 * never cut. `refit` changes when the box around it changes size.
 */
export function useFitText(
  ref: RefObject<HTMLElement | null>,
  text: string,
  maxLines: number,
  refit: string,
  card?: RefObject<HTMLElement | null>
): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    el.style.fontSize = ''
    let size = Number.parseFloat(getComputedStyle(el).fontSize)
    const fits = (): boolean =>
      el.scrollWidth <= el.clientWidth + 0.5 &&
      lineCount(el) <= maxLines &&
      (!card?.current || card.current.scrollHeight <= card.current.clientHeight + 0.5)
    while (size > MIN_FONT_PX && !fits()) {
      size -= FONT_STEP_PX
      el.style.fontSize = `${size}px`
    }
  }, [ref, card, text, maxLines, refit])
}
