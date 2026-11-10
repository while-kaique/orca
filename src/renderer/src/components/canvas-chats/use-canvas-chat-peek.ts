import { useEffect, useRef, useState } from 'react'

export const PEEK_W = 560

/**
 * Hover a closed card for a moment to peek at it live; the close X's zone never starts it; leaving ends it.
 * While the close confirmation is up, the card holds whatever size it had (expanded or not).
 */
export function usePeek(
  open: boolean,
  cardRef: React.RefObject<HTMLDivElement | null>
): {
  on: boolean
  over: (e: React.PointerEvent) => void
  leave: () => void
  hold: () => void
  release: () => void
} {
  const [on, setOn] = useState(false)
  const [held, setHeld] = useState<boolean | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stop = (): void => {
    clearTimeout(timer.current)
    timer.current = undefined
  }
  return {
    on: (held ?? on) && !open,
    over: (e) => {
      if (held !== null || (e.target as Element).closest('.cc-xwrap, .cc-confirm')) {
        stop()
        return
      }
      if (!on && timer.current === undefined) {
        timer.current = setTimeout(() => setOn(true), 220)
      }
    },
    leave: () => {
      stop()
      setOn(false)
    },
    hold: () => {
      stop()
      setHeld(on)
    },
    release: () => {
      setHeld(null)
      setOn(Boolean(on && cardRef.current?.matches(':hover')))
    }
  }
}

/** Seconds since `active` turned on (-1 while off), for the "restoring" counter. */
export function useSecondsWhile(active: boolean): number {
  const [seconds, setSeconds] = useState(-1)
  useEffect(() => {
    if (!active) {
      setSeconds(-1)
      return
    }
    const startedAt = Date.now()
    setSeconds(0)
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(tick)
  }, [active])
  return seconds
}
