import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { CanvasQueueItem } from './canvas-chat-hierarchy'
import type { CanvasProject } from './canvas-chats-layout'

function itemTitle(item: CanvasQueueItem): string {
  if (item.tipo === 'ok') {
    return translate('fork.canvas.queue.ok', 'Pede o seu OK')
  }
  return item.tipo === 'pergunta'
    ? translate('fork.canvas.queue.question', 'Pergunta para você')
    : translate('fork.canvas.queue.rejectedTwice', 'Reprovada 2 vezes: decida')
}

/** Everything that waits for the user, from every project, in one place. */
export function CanvasUserQueue({
  projects,
  onOpenChat
}: {
  projects: readonly CanvasProject[]
  onOpenChat: (chatKey: string) => void
}): React.JSX.Element | null {
  const [returning, setReturning] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState('')
  const rows = projects.flatMap((project) => project.queue.map((item) => ({ project, item })))
  if (rows.length === 0) {
    return null
  }
  const decide = (item: CanvasQueueItem, decisao: 'ok' | 'devolver'): void => {
    if (!item.ordemId) {
      return
    }
    void window.api.repos
      .decideCanvasHierarchyOrder({
        folder: item.folder,
        ordemId: item.ordemId,
        decisao,
        ...(decisao === 'devolver' ? { motivo: reason } : {})
      })
      .then((result) => {
        setFailure(result.kind === 'error' ? result.error : '')
        if (result.kind === 'ok') {
          setReturning(null)
          setReason('')
        }
      })
  }
  return (
    <div
      className="cc-queue"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <b>
        {translate('fork.canvas.queue.title', 'Esperando você')} · {rows.length}
      </b>
      {rows.map(({ project, item }) => {
        const id = `${item.folder}:${item.ordemId ?? item.perguntaId}`
        return (
          <div key={id} className="cc-queue-item" style={{ borderLeftColor: project.color }}>
            <small>
              {project.name} · {itemTitle(item)}
            </small>
            <span>{item.resumo || item.texto || item.ordemId}</span>
            <div>
              {item.tipo === 'ok' ? (
                <>
                  <button type="button" className="cc-queue-ok" onClick={() => decide(item, 'ok')}>
                    {translate('fork.canvas.queue.approve', 'OK')}
                  </button>
                  <button type="button" onClick={() => setReturning(returning === id ? null : id)}>
                    {translate('fork.canvas.queue.return', 'Devolver')}
                  </button>
                </>
              ) : null}
              {item.chatKey ? (
                <button type="button" onClick={() => onOpenChat(item.chatKey as string)}>
                  {translate('fork.canvas.queue.open', 'Abrir o chat')}
                </button>
              ) : null}
            </div>
            {returning === id ? (
              <div className="cc-queue-reason">
                <input
                  value={reason}
                  placeholder={translate('fork.canvas.queue.reason', 'Por que devolver?')}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  type="button"
                  disabled={reason.trim() === ''}
                  onClick={() => decide(item, 'devolver')}
                >
                  {translate('fork.canvas.queue.send', 'Enviar')}
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
      {failure ? <small className="cc-queue-error">{failure}</small> : null}
    </div>
  )
}
