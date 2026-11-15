import { Moon, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'

/** 'choose' = the three options; the 'confirm-*' stages warn a chat that is working about what the stop loses. */
export type CanvasChatCloseStage = 'choose' | 'confirm-suspend' | 'confirm-close'

/** Fork: what the card's X asks. Suspend stops the process and keeps the conversation; close stops it and removes the card. */
export function CanvasChatCloseDialog({
  stage,
  name,
  working,
  hasAgents,
  canSuspend,
  onStage,
  onSuspend,
  onCloseForGood
}: {
  stage: CanvasChatCloseStage | null
  name: string
  working: boolean
  hasAgents: boolean
  canSuspend: boolean
  onStage: (stage: CanvasChatCloseStage | null) => void
  onSuspend: () => void
  onCloseForGood: () => void
}): React.JSX.Element {
  // The portal's clicks bubble through React to the card, which would open it.
  const keepOffCard = (e: React.SyntheticEvent): void => e.stopPropagation()
  const choose = stage === 'choose'
  const confirmSuspend = stage === 'confirm-suspend'
  return (
    <span onClick={keepOffCard} onPointerDown={keepOffCard}>
      <Dialog open={choose} onOpenChange={(open) => !open && onStage(null)}>
        {/* Three buttons do not fit the compact width: the default width, and the footer wraps on narrow windows. */}
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {translate('fork.canvas.closeChatAsk', 'O que fazer com o chat "{{name}}"?', {
                name
              })}
            </DialogTitle>
            <DialogDescription>
              {canSuspend
                ? translate(
                    'fork.canvas.closeChatChoices',
                    'Suspender para o processo e guarda a conversa: o card fica no lugar e um clique acorda. Fechar definitivamente para o processo e tira o card.'
                  )
                : translate(
                    'fork.canvas.closeChatSuspendedGone',
                    'Fechar definitivamente tira o card e não deixa nada rodando.'
                  )}
              {hasAgents
                ? ` ${translate('fork.canvas.closeChatAgents', 'Os agentes dele também param.')}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" onClick={() => onStage(null)}>
              {translate('fork.canvas.closeChatNo', 'Cancelar')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => (working ? onStage('confirm-close') : onCloseForGood())}
            >
              {translate('fork.canvas.closeChatForGood', 'Fechar definitivamente')}
            </Button>
            {canSuspend ? (
              <Button
                autoFocus
                onClick={() => (working ? onStage('confirm-suspend') : onSuspend())}
              >
                {translate('fork.canvas.suspendChat', 'Suspender')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={stage === 'confirm-suspend' || stage === 'confirm-close'}
        onOpenChange={(open) => !open && onStage(null)}
      >
        <DialogContent size="compact" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {translate('fork.canvas.stopWorkingAsk', 'O chat "{{name}}" está trabalhando', {
                name
              })}
            </DialogTitle>
            <DialogDescription>
              {confirmSuspend
                ? translate(
                    'fork.canvas.suspendWorkingWarn',
                    'O chat está trabalhando agora. Suspender interrompe a vez no meio: a vez em andamento para, mas a conversa fica guardada.'
                  )
                : translate(
                    'fork.canvas.closeWorkingWarn',
                    'O chat está trabalhando agora. Fechar interrompe a vez no meio: o que ele estava fazendo para e o que não foi salvo se perde.'
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" onClick={() => onStage(null)}>
              {translate('fork.canvas.closeChatNo', 'Cancelar')}
            </Button>
            {confirmSuspend ? (
              <Button onClick={onSuspend}>
                {translate('fork.canvas.suspendAnyway', 'Suspender mesmo assim')}
              </Button>
            ) : (
              <Button variant="destructive" onClick={onCloseForGood}>
                {translate('fork.canvas.closeAnyway', 'Fechar mesmo assim')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  )
}

/** The two round buttons floating above a card on hover: suspend (not on a chat already suspended) and close. */
export function CanvasChatStopButtons({
  suspended,
  onAsk
}: {
  suspended: boolean
  onAsk: () => void
}): React.JSX.Element {
  const ask = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onAsk()
  }
  return (
    <span className="cc-xwrap cc-xwrap-pair" onPointerDown={(e) => e.stopPropagation()}>
      {suspended ? null : (
        <button
          type="button"
          className="cc-xbtn cc-sbtn"
          title={translate(
            'fork.canvas.suspendChatHint',
            'Suspender: para o processo e guarda a conversa'
          )}
          onClick={ask}
        >
          <Moon size={13} />
        </button>
      )}
      <button
        type="button"
        className="cc-xbtn"
        title={translate('fork.canvas.closeChat', 'Fechar este chat')}
        onClick={ask}
      >
        <X size={13} />
      </button>
    </span>
  )
}
