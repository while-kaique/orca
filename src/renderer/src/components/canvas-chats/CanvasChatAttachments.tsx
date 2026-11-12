import { useEffect, useRef, useState } from 'react'
import { Bot, FileText, Globe, Image as ImageIcon, Loader2, SquareTerminal, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { dismissCanvasChatArtifact } from './canvas-chat-artifacts'
import { useCanvasImage } from './canvas-chat-images'
import { chatVisualBox } from './canvas-chat-shape'
import { ExtraNode } from './CanvasChatExtras'
import {
  CANVAS_ATTACHMENTS_ROW,
  isFreeChat,
  type CanvasAgent,
  type CanvasBox,
  type CanvasChat,
  type CanvasExtra
} from './canvas-chats-layout'

type Kind = 'agent' | 'artifact' | 'server' | 'image'

const KINDS: { kind: Kind; icon: typeof Bot; one: string; many: string }[] = [
  { kind: 'agent', icon: Bot, one: 'agente', many: 'agentes' },
  { kind: 'artifact', icon: FileText, one: 'artefato', many: 'artefatos' },
  { kind: 'server', icon: Globe, one: 'localhost', many: 'localhosts' },
  { kind: 'image', icon: ImageIcon, one: 'imagem', many: 'imagens' }
]

function AgentRow({ agent }: { agent: CanvasAgent }): React.JSX.Element {
  const Icon = agent.kind === 'task' ? SquareTerminal : Bot
  return (
    <div className="cc-chip-agent" data-status={agent.blocked ? 'waiting' : agent.status}>
      <span className="cc-dot" />
      <Icon size={13} />
      <b>{agent.name}</b>
      <small>
        {agent.blocked
          ? translate('fork.canvas.agentBlockedShort', 'esperando você')
          : agent.kind === 'task'
            ? translate('fork.canvas.taskShort', 'processo de fundo')
            : translate('fork.canvas.agentShort', 'agente')}
      </small>
    </div>
  )
}

function ImageTile({
  extra,
  onExpand
}: {
  extra: CanvasExtra
  onExpand: () => void
}): React.JSX.Element {
  const picture = useCanvasImage(extra.url, 'thumb')
  return (
    <div className="cc-image-tile" title={extra.url} onClick={picture ? onExpand : undefined}>
      <button
        type="button"
        className="cc-image-x"
        title={translate('fork.canvas.hideImage', 'Tirar esta imagem do fluxograma')}
        onClick={(e) => {
          e.stopPropagation()
          dismissCanvasChatArtifact(extra.url)
        }}
      >
        <X size={11} />
      </button>
      <div className="cc-image-shot">
        {picture ? (
          <img src={picture} alt="" draggable={false} />
        ) : picture === null ? (
          <span>{translate('fork.canvas.imageGone', 'arquivo não está mais lá')}</span>
        ) : (
          <Loader2 size={14} className="cc-voice-spin" />
        )}
      </div>
      <b>{extra.label}</b>
    </div>
  )
}

/** Fork: one thin row of chips under a chat, one per kind of thing it left; a chip opens that kind's gallery. */
export function CanvasChatAttachments({
  chat,
  box,
  onExpand
}: {
  chat: CanvasChat
  box: CanvasBox
  onExpand: (extra: CanvasExtra) => void
}): React.JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null)
  const [openKind, setOpenKind] = useState<Kind | null>(null)
  useEffect(() => {
    if (!openKind) {
      return
    }
    const onDown = (e: PointerEvent): void => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) {
        setOpenKind(null)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpenKind(null)
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [openKind])

  const extrasOf = (kind: Kind): CanvasExtra[] => chat.extras.filter((extra) => extra.kind === kind)
  const countOf = (kind: Kind): number =>
    kind === 'agent' ? chat.agents.length : extrasOf(kind).length
  const shown = KINDS.filter(({ kind }) => countOf(kind) > 0)
  if (shown.length === 0) {
    return null
  }
  const visual = chatVisualBox(chat, box)
  // A free chat sits above its project: its chips stack upward so they never land on the project.
  const above = isFreeChat(chat)
  const open = shown.find(({ kind }) => kind === openKind)
  const expand = (extra: CanvasExtra): void => {
    setOpenKind(null)
    onExpand(extra)
  }
  return (
    <div
      ref={rootRef}
      className={`cc-node cc-chips${open ? ' cc-chips-open' : ''}${above ? ' cc-chips-above' : ''}`}
      style={{
        left: visual.x,
        top: above
          ? visual.y - CANVAS_ATTACHMENTS_ROW.gap - CANVAS_ATTACHMENTS_ROW.h
          : visual.y + visual.h + CANVAS_ATTACHMENTS_ROW.gap,
        width: visual.w,
        height: CANVAS_ATTACHMENTS_ROW.h
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {shown.map(({ kind, icon: Icon, one, many }) => (
        <button
          key={kind}
          type="button"
          className="cc-chip"
          data-kind={kind}
          data-on={openKind === kind ? '1' : undefined}
          title={`${countOf(kind)} ${countOf(kind) === 1 ? one : many}`}
          onClick={() => setOpenKind(openKind === kind ? null : kind)}
        >
          <Icon size={13} />
          {countOf(kind)}
        </button>
      ))}
      {open ? (
        <div className="cc-chip-pop" data-kind={open.kind}>
          <div className="cc-chip-pop-head">
            <open.icon size={13} />
            <b>
              {countOf(open.kind)} {countOf(open.kind) === 1 ? open.one : open.many}
            </b>
            <span>{chat.title}</span>
          </div>
          {open.kind === 'agent' ? (
            <div className="cc-chip-agents">
              {chat.agents.map((agent) => (
                <AgentRow key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="cc-chip-grid">
              {extrasOf(open.kind).map((extra) =>
                extra.kind === 'image' ? (
                  <ImageTile key={extra.id} extra={extra} onExpand={() => expand(extra)} />
                ) : (
                  <ExtraNode
                    key={extra.id}
                    extra={extra}
                    turnKey={chat.status === 'working' ? '' : `${chat.startedAt}`}
                    onExpand={() => expand(extra)}
                  />
                )
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** A chat's image, large. Lives outside the zoomed board, like the page preview. */
export function CanvasImagePreview({
  extra,
  onClose
}: {
  extra: CanvasExtra
  onClose: () => void
}): React.JSX.Element {
  const picture = useCanvasImage(extra.url, 'full')
  return (
    <div className="cc-web cc-image-view" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cc-web-head">
        <span className="cc-extra-icon">
          <ImageIcon size={13} />
        </span>
        <b title={extra.url}>{extra.label}</b>
        <button
          type="button"
          className="cc-head-button"
          title={translate('fork.canvas.collapse', 'Recolher')}
          onClick={onClose}
        >
          <X size={13} />
        </button>
      </div>
      <div className="cc-image-view-body" onClick={onClose}>
        {picture ? (
          <img src={picture} alt="" draggable={false} />
        ) : picture === null ? (
          <span>{translate('fork.canvas.imageGone', 'arquivo não está mais lá')}</span>
        ) : (
          <Loader2 size={18} className="cc-voice-spin" />
        )}
      </div>
    </div>
  )
}
