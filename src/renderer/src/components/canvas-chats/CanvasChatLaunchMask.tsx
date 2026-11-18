import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useWorktreeActivityStatus } from '../sidebar/workspace-card/activity/use-worktree-activity-status'
import { CanvasChatOpenProblem, CanvasChatOpenSteps } from './CanvasChatOpenSteps'
import {
  endLaunchRecord,
  freeChatMaskDone,
  freeChatMaskView,
  launchMaskView,
  markFreeChatReady,
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
    case 'no-request':
      return translate(
        'fork.canvas.launch.reasonNoRequest',
        'O chat abriu mas não recebeu o pedido de início.'
      )
  }
}

/** Covers a freshly launched PO card with its three start-up steps, or with the problem that stopped it. */
function PoLaunchMask({
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
  // A ready PO the user opened needs no mask: opening it is the user's first look at it.
  const readyAndOpen = open && view.kind === 'steps' && view.step === 3
  useEffect(() => {
    if (readyAndOpen) {
      endLaunchRecord(chat.tabId)
    }
  }, [readyAndOpen, chat.tabId])
  if (open) {
    return null
  }
  if (view.kind === 'problem') {
    return (
      <CanvasChatOpenProblem
        title={translate('fork.canvas.launch.problemTitle', 'Deu problema ao abrir o PO')}
        stoppedAt={translate('fork.canvas.launch.stoppedAt', 'Parou em: {{step}}', {
          step: stepLabel(view.problem.step)
        })}
        reason={reasonLabel(view.problem.reason)}
        hint={translate('fork.canvas.launch.openHint', 'Abra o chat para ver o que aconteceu.')}
      />
    )
  }
  return (
    <CanvasChatOpenSteps
      title={translate('fork.canvas.launch.title', 'Abrindo o PO')}
      labels={[stepLabel(1), stepLabel(2), stepLabel(3)]}
      step={view.step}
      note={
        view.askingPermission
          ? translate(
              'fork.canvas.launch.permission',
              'Pedindo permissão: abra o chat para responder'
            )
          : null
      }
    />
  )
}

function freeStepLabel(step: LaunchStep): string {
  switch (step) {
    case 1:
      return translate('fork.canvas.free.step1', 'Abrindo o terminal')
    case 2:
      return translate('fork.canvas.free.step2', 'Iniciando o Claude')
    case 3:
      return translate('fork.canvas.free.step3', 'Pronto para conversar')
  }
}

/** Covers a free chat that is opening with its three steps; it leaves by itself once Claude is up. */
function FreeChatLaunchMask({
  chat,
  record,
  open
}: {
  chat: CanvasChat
  record: LaunchRecord
  open: boolean
}): React.JSX.Element | null {
  const status = useWorktreeActivityStatus(chat.worktreeId, chat.tabId)
  const hasTerminal = useAppStore((s) => (s.ptyIdsByTabId[chat.tabId]?.length ?? 0) > 0)
  // Claude's SessionStart hook is what makes the agent's state appear for this tab: the Claude is up and waiting.
  const claudeStarted = useAppStore((s) =>
    Object.values(s.agentStatusByPaneKey).some((entry) => entry.tabId === chat.tabId)
  )
  const [now, setNow] = useState(() => Date.now())
  const stopped = record.problem !== null
  useEffect(() => {
    if (stopped) {
      return
    }
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [stopped])
  const view = freeChatMaskView(record, { hasTerminal, claudeStarted, now })
  useLaunchFactsKeeper(chat.tabId, view, { status, role: null, hasTerminal, now })
  const ready = view.kind === 'steps' && view.step === 3
  useEffect(() => {
    if (ready) {
      markFreeChatReady(chat.tabId)
    }
  }, [ready, chat.tabId])
  const finished = freeChatMaskDone(record, now)
  useEffect(() => {
    if (finished) {
      endLaunchRecord(chat.tabId)
    }
  }, [finished, chat.tabId])
  if (open || finished) {
    return null
  }
  if (view.kind === 'problem') {
    return (
      <CanvasChatOpenProblem
        title={translate('fork.canvas.free.problemTitle', 'Deu problema ao abrir o chat')}
        stoppedAt={translate('fork.canvas.launch.stoppedAt', 'Parou em: {{step}}', {
          step: freeStepLabel(view.problem.step)
        })}
        reason={
          view.problem.reason === 'terminal'
            ? reasonLabel('terminal')
            : translate(
                'fork.canvas.free.reasonNeverStarted',
                'O Claude não começou a rodar em 2 minutos.'
              )
        }
        hint={translate('fork.canvas.launch.openHint', 'Abra o chat para ver o que aconteceu.')}
      />
    )
  }
  return (
    <CanvasChatOpenSteps
      title={translate('fork.canvas.free.title', 'Abrindo o chat')}
      labels={[freeStepLabel(1), freeStepLabel(2), freeStepLabel(3)]}
      step={view.step}
      complete={ready}
    />
  )
}

/** The mask of a card that is opening: a PO launched by the hierarchy, or a free chat starting on its own. */
export function CanvasChatLaunchMask(props: {
  chat: CanvasChat
  record: LaunchRecord
  /** An open card shows its real terminal, but the mask keeps tracking the launch underneath. */
  open: boolean
}): React.JSX.Element | null {
  return props.record.kind === 'free' ? (
    <FreeChatLaunchMask {...props} />
  ) : (
    <PoLaunchMask {...props} />
  )
}
