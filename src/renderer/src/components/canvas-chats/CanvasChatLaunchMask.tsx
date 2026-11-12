import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useWorktreeActivityStatus } from '../sidebar/workspace-card/activity/use-worktree-activity-status'
import {
  launchMaskView,
  useLaunchFactsKeeper,
  type LaunchFacts,
  type LaunchProblemReason,
  type LaunchRecord,
  type LaunchStep
} from './canvas-chat-launch-mask'
import type { CanvasChat } from './canvas-chats-layout'

function stepLabel(step: LaunchStep): string {
  switch (step) {
    case 1:
      return translate('fork.canvas.launch.step1', 'Iniciando...')
    case 2:
      return translate('fork.canvas.launch.step2', 'Carregando funções...')
    case 3:
      return translate('fork.canvas.launch.step3', 'Esperando um pedido')
  }
}

function reasonLabel(reason: LaunchProblemReason): string {
  switch (reason) {
    case 'terminal':
      return translate('fork.canvas.launch.reasonTerminal', 'O terminal do chat fechou.')
    case 'agent':
      return translate(
        'fork.canvas.launch.reasonAgent',
        'O agente parou com erro antes de terminar de subir.'
      )
    case 'registry':
      return translate(
        'fork.canvas.launch.reasonRegistry',
        'O chat terminou de subir mas não se registrou como PO.'
      )
    case 'never-started':
      return translate(
        'fork.canvas.launch.reasonNeverStarted',
        'O agente não começou a rodar em 2 minutos.'
      )
  }
}

/** Covers a freshly launched PO card with its three start-up steps, or with the problem that stopped it. */
export function CanvasChatLaunchMask({
  chat,
  record,
  open
}: {
  chat: CanvasChat
  record: LaunchRecord
  /** An open card shows its real terminal, but the mask keeps tracking the launch underneath. */
  open: boolean
}): React.JSX.Element | null {
  const status = useWorktreeActivityStatus(chat.worktreeId, chat.tabId)
  const hasTerminal = useAppStore((s) => (s.ptyIdsByTabId[chat.tabId]?.length ?? 0) > 0)
  const [now, setNow] = useState(() => Date.now())
  const stopped = record.problem !== null
  useEffect(() => {
    if (stopped) {
      return
    }
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [stopped])
  const facts: LaunchFacts = {
    status,
    role: chat.hierarchy?.role ?? null,
    hasTerminal,
    now
  }
  const view = launchMaskView(record, facts)
  useLaunchFactsKeeper(chat.tabId, view, facts)
  if (open) {
    return null
  }
  if (view.kind === 'problem') {
    return (
      <div className="chat-restore-loading cc-launch cc-launch-problem" role="alert">
        <b>{translate('fork.canvas.launch.problemTitle', 'Deu problema ao abrir o PO')}</b>
        <small>
          {translate('fork.canvas.launch.stoppedAt', 'Parou em: {{step}}', {
            step: stepLabel(view.problem.step)
          })}
        </small>
        <small>{reasonLabel(view.problem.reason)}</small>
        <small className="cc-launch-hint">
          {translate('fork.canvas.launch.openHint', 'Abra o chat para ver o que aconteceu.')}
        </small>
      </div>
    )
  }
  return (
    <div className="chat-restore-loading cc-launch" role="status">
      <b className="cc-launch-title">{translate('fork.canvas.launch.title', 'Abrindo o PO')}</b>
      <ol className="cc-launch-steps">
        {([1, 2, 3] as const).map((step) => {
          const state = step < view.step ? 'done' : step === view.step ? 'now' : 'next'
          return (
            <li key={step} data-state={state}>
              {state === 'done' ? (
                <Check size={14} className="cc-launch-mark" />
              ) : state === 'now' ? (
                <span
                  className={
                    step === 3 ? 'cc-launch-wait' : 'chat-restore-loading-spin cc-launch-spin'
                  }
                />
              ) : (
                <span className="cc-launch-empty" />
              )}
              <span>{stepLabel(step)}</span>
            </li>
          )
        })}
      </ol>
      {view.askingPermission ? (
        <small>
          {translate(
            'fork.canvas.launch.permission',
            'Pedindo permissão: abra o chat para responder'
          )}
        </small>
      ) : null}
    </div>
  )
}
