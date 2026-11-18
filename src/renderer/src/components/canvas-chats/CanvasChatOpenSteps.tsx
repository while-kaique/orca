import { Check } from 'lucide-react'
import type { LaunchStep } from './canvas-chat-launch-mask'

/**
 * The card's opening screen: a title and three steps that light in order, or the step that stopped with its
 * problem. The PO's start-up, a free chat's start-up and a sleeping chat waking all draw it, each with its own words.
 */
export function CanvasChatOpenSteps({
  title,
  labels,
  step,
  complete = false,
  note
}: {
  title: string
  labels: readonly [string, string, string]
  step: LaunchStep
  /** Every step lit: the last signal arrived and the screen is about to leave. */
  complete?: boolean
  note?: string | null
}): React.JSX.Element {
  return (
    <div className="chat-restore-loading cc-launch" role="status">
      <b className="cc-launch-title">{title}</b>
      <ol className="cc-launch-steps">
        {([1, 2, 3] as const).map((n) => {
          const state = complete || n < step ? 'done' : n === step ? 'now' : 'next'
          return (
            <li key={n} data-state={state}>
              {state === 'done' ? (
                <Check size={14} className="cc-launch-mark" />
              ) : state === 'now' ? (
                <span
                  className={
                    n === 3 ? 'cc-launch-wait' : 'chat-restore-loading-spin cc-launch-spin'
                  }
                />
              ) : (
                <span className="cc-launch-empty" />
              )}
              <span>{labels[n - 1]}</span>
            </li>
          )
        })}
      </ol>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

export function CanvasChatOpenProblem({
  title,
  stoppedAt,
  reason,
  hint
}: {
  title: string
  stoppedAt: string
  reason: string
  hint: string
}): React.JSX.Element {
  return (
    <div className="chat-restore-loading cc-launch cc-launch-problem" role="alert">
      <b>{title}</b>
      <small>{stoppedAt}</small>
      <small>{reason}</small>
      <small className="cc-launch-hint">{hint}</small>
    </div>
  )
}
