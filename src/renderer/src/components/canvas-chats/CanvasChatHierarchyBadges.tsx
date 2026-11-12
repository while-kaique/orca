import { translate } from '@/i18n/i18n'
import type { CanvasHierarchyOrderState } from '../../../../shared/canvas-hierarchy'
import { useCanvasChatTranscriptModel } from './canvas-chat-context-tokens'
import { canvasChatModelLabel } from './canvas-chat-model-label'
import type { CanvasChat } from './canvas-chats-layout'

function roleLabel(role: NonNullable<CanvasChat['hierarchy']>['role']): string {
  if (role === 'po') {
    return translate('fork.canvas.role.po', 'PO')
  }
  return role === 'planejador'
    ? translate('fork.canvas.role.planner', 'Planejador')
    : translate('fork.canvas.role.executor', 'Executor')
}

export function orderStateLabel(state: CanvasHierarchyOrderState): string {
  switch (state) {
    case 'em_espera':
      return translate('fork.canvas.gate.queued', 'na fila')
    case 'trabalhando':
      return translate('fork.canvas.gate.working', 'trabalhando')
    case 'em_prova':
      return translate('fork.canvas.gate.proof', 'falta a prova')
    case 'conferindo_plano':
      return translate('fork.canvas.gate.plan', 'planejador conferindo')
    case 'conferindo_produto':
      return translate('fork.canvas.gate.product', 'PO conferindo')
    case 'aprovado':
      return translate('fork.canvas.gate.approved', 'aprovado')
    case 'esperando_kaique':
      return translate('fork.canvas.gate.user', 'esperando o seu OK')
    case 'liberado':
      return translate('fork.canvas.gate.released', 'liberado por você')
    case 'devolvido':
      return translate('fork.canvas.gate.returned', 'devolvido para corrigir')
    case 'parou':
      return translate('fork.canvas.gate.stopped', 'parou sem entregar')
    case 'subiu':
      return translate('fork.canvas.gate.escalated', 'reprovado 2x, subiu um nível')
  }
}

/** PO, planner or executor beside the chat's name; a chat outside the hierarchy reads 'Livre'. */
export function CanvasChatRole({ chat }: { chat: CanvasChat }): React.JSX.Element {
  return chat.hierarchy ? (
    <span className="cc-role" data-role={chat.hierarchy.role}>
      {roleLabel(chat.hierarchy.role)}
    </span>
  ) : (
    <span className="cc-role" data-role="free">
      {translate('fork.canvas.role.free', 'Livre')}
    </span>
  )
}

/** The model the chat runs now: its transcript (Claude's status record has none), else the status record. */
export function CanvasChatModel({ chat }: { chat: CanvasChat }): React.JSX.Element | null {
  const transcriptModel = useCanvasChatTranscriptModel(chat.transcriptPath)
  const label = canvasChatModelLabel(transcriptModel ?? chat.model)
  return label ? (
    <span className="cc-model" data-family={label.family}>
      {label.label}
    </span>
  ) : null
}

/** Where the chat's delivery stands, what waits for it to check, and whether the user stepped in. */
export function CanvasChatGate({ chat }: { chat: CanvasChat }): React.JSX.Element | null {
  const hierarchy = chat.hierarchy
  if (!hierarchy) {
    return null
  }
  const parts: string[] = []
  if (hierarchy.order) {
    parts.push(orderStateLabel(hierarchy.order.state))
    if (hierarchy.order.rejections > 0) {
      parts.push(
        translate('fork.canvas.gate.rejections', 'reprovada {{count}}x', {
          count: hierarchy.order.rejections
        })
      )
    }
  }
  if (hierarchy.toCheck > 0) {
    parts.push(
      translate('fork.canvas.gate.toCheck', '{{count}} para conferir', { count: hierarchy.toCheck })
    )
  }
  if (hierarchy.touchedByUser) {
    parts.push(translate('fork.canvas.gate.touched', 'você mexeu aqui'))
  }
  return parts.length > 0 ? (
    <div className="cc-gate" data-gate={hierarchy.order?.state ?? 'none'}>
      {parts.join(' · ')}
    </div>
  ) : null
}
