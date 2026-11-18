import { translate } from '@/i18n/i18n'
import type { LaunchStep } from './canvas-chat-launch-mask'
import { wakeMaskView, type WakeFacts } from './canvas-chat-wake-steps'
import { CanvasChatOpenProblem, CanvasChatOpenSteps } from './CanvasChatOpenSteps'

function wakeStepLabel(step: LaunchStep): string {
  switch (step) {
    case 1:
      return translate('fork.canvas.wake.step1', 'Abrindo o terminal')
    case 2:
      return translate('fork.canvas.wake.step2', 'Retomando a conversa')
    case 3:
      return translate('fork.canvas.wake.step3', 'Claude pronto')
  }
}

/** Covers the open card of a chat that was asleep: the steps of its waking, or where it stopped and why. */
export function CanvasChatWakeMask({
  facts,
  problemReason
}: {
  facts: WakeFacts
  /** Why the terminal is gone, in the words the terminal preview already uses. */
  problemReason: string
}): React.JSX.Element {
  const view = wakeMaskView(facts)
  if (view.kind === 'problem') {
    return (
      <CanvasChatOpenProblem
        title={translate('fork.canvas.wake.problemTitle', 'Deu problema ao acordar o chat')}
        stoppedAt={translate('fork.canvas.launch.stoppedAt', 'Parou em: {{step}}', {
          step: wakeStepLabel(view.step)
        })}
        reason={problemReason}
        hint={translate('fork.canvas.wake.problemHint', 'Feche o chat e abra de novo.')}
      />
    )
  }
  return (
    <CanvasChatOpenSteps
      title={translate('fork.canvas.wake.title', 'Acordando o chat')}
      labels={[wakeStepLabel(1), wakeStepLabel(2), wakeStepLabel(3)]}
      step={view.step}
    />
  )
}
