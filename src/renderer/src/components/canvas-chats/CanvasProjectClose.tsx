import { useState } from 'react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { closePcDeskChat } from '../sidebar/pc-desk-switcher/close-pc-desk-project'
import type { CanvasProject } from './canvas-chats-layout'

/** Floating X on the project card; confirming closes every chat of the project, one by one like each chat's own X. */
export function CanvasProjectClose({ project }: { project: CanvasProject }): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const count = project.chats.length
  return (
    <>
      <span className="cc-xwrap" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="cc-xbtn"
          title={translate('fork.canvas.closeProject', 'Fechar todos os chats deste projeto')}
          onClick={(e) => {
            e.stopPropagation()
            setConfirming(true)
          }}
        >
          <X size={13} />
        </button>
      </span>
      {confirming ? (
        <div
          className="cc-confirm"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <b>
            {translate('fork.canvas.closeProjectAsk', 'Fechar o projeto "{{name}}"?', {
              name: project.name
            })}
          </b>
          <small>
            {count === 1
              ? translate('fork.canvas.closeProjectOne', '1 chat será fechado.')
              : translate('fork.canvas.closeProjectMany', '{{count}} chats serão fechados.', {
                  count
                })}
          </small>
          <div>
            <button
              type="button"
              className="cc-confirm-ok"
              onClick={() => {
                for (const chat of project.chats) {
                  closePcDeskChat(chat.worktreeId, chat.tabId)
                }
              }}
            >
              {translate('fork.canvas.closeChatYes', 'Fechar')}
            </button>
            <button
              type="button"
              className="cc-confirm-cancel"
              onClick={() => setConfirming(false)}
            >
              {translate('fork.canvas.closeChatNo', 'Cancelar')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
