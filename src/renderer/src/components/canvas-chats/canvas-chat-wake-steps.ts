import type { LaunchStep } from './canvas-chat-launch-mask'

/** What the card knows while a sleeping chat wakes; each fact comes from a real signal, never from time. */
export type WakeFacts = {
  /** The terminal answered: the card's terminal view connected to the chat's process. */
  terminalAnswered: boolean
  /** Claude reported its resumed session (its SessionStart hook) after the wake began. */
  conversationLoaded: boolean
  /** The terminal never came back and the card stopped waiting. */
  gaveUp: boolean
}

export type WakeView =
  | { kind: 'steps'; step: LaunchStep }
  | { kind: 'problem'; step: LaunchStep; reason: 'terminal-gone' }

/** Step 1 until the terminal answers, 2 until Claude loaded the conversation, 3 until its input box is drawn. */
export function wakeMaskView(facts: WakeFacts): WakeView {
  const step: LaunchStep = !facts.terminalAnswered ? 1 : !facts.conversationLoaded ? 2 : 3
  return facts.gaveUp ? { kind: 'problem', step, reason: 'terminal-gone' } : { kind: 'steps', step }
}
