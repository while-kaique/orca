import { useRef } from 'react'
import { Bot, ExternalLink, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { revealDashboardAgent } from '../dashboard/reveal-dashboard-agent'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import type { CanvasAgent, CanvasBox, CanvasChat, CanvasProject } from './canvas-chats-layout'
import { CanvasVoiceBar } from './CanvasVoiceBar'

export const OPEN_CARD = { w: 640, h: 460 }

export const STATUS_LABEL: Record<CanvasChat['status'], string> = {
  idle: translate('fork.canvas.statusIdle', 'parado'),
  working: translate('fork.canvas.statusWorking', 'trabalhando'),
  unseen: translate('fork.canvas.statusUnseen', 'terminou'),
  seen: translate('fork.canvas.statusSeen', 'visto'),
  waiting: translate('fork.canvas.statusWaiting', 'precisa de você')
}

export function ProjectNode({
  project,
  box
}: {
  project: CanvasProject
  box: CanvasBox
}): React.JSX.Element {
  const count = (s: CanvasChat['status']): number =>
    project.chats.filter((c) => c.status === s).length
  const agents = project.chats.reduce((n, c) => n + c.agents.length, 0)
  return (
    <div className="cc-node cc-project" style={{ left: box.x, top: box.y, width: box.w }}>
      <div className="cc-project-name">{project.name}</div>
      {project.detail ? <div className="cc-project-detail">{project.detail}</div> : null}
      <div className="cc-pills">
        <span className="cc-pill">
          {project.chats.length} chats · {agents} agentes
        </span>
        {(['waiting', 'working', 'unseen'] as const).map((s) =>
          count(s) ? (
            <span
              key={s}
              className={`cc-pill cc-pill-${s}`}
              title={`${count(s)} ${STATUS_LABEL[s]}`}
            >
              <i />
              {count(s)}
            </span>
          ) : null
        )}
      </div>
    </div>
  )
}

export function AgentNode({
  agent,
  box
}: {
  agent: CanvasAgent
  box: CanvasBox
}): React.JSX.Element {
  const line = agent.blocked
    ? translate('fork.canvas.agentBlocked', '⏸ esperando você responder o chat')
    : (agent.card?.lastAgentMessage ?? STATUS_LABEL[agent.status])
  return (
    <div
      className="cc-node cc-agent"
      data-status={agent.status}
      data-blocked={agent.blocked ? '1' : undefined}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      title={agent.name}
    >
      <div className="cc-agent-head">
        <span className="cc-bot">
          <Bot size={13} />
        </span>
        <b>{agent.name}</b>
      </div>
      <div className="cc-agent-line">{line}</div>
    </div>
  )
}

export function ChatNode({
  chat,
  box,
  open,
  onOpen,
  onClose
}: {
  chat: CanvasChat
  box: CanvasBox
  open: boolean
  onOpen: () => void
  onClose: () => void
}): React.JSX.Element {
  const { card } = chat
  const cardRef = useRef<HTMLDivElement>(null)
  const showInNormalView = (): void => {
    if (
      revealDashboardAgent({
        repoId: card.repoId,
        worktreeId: card.worktreeId,
        executionHostId: card.executionHostId,
        tabId: card.tabId,
        leafId: card.leafId
      })
    ) {
      useAppStore.getState().setActiveView('terminal')
    }
  }
  const style = open
    ? {
        left: box.x + box.w / 2 - OPEN_CARD.w / 2,
        top: box.y,
        width: OPEN_CARD.w,
        height: OPEN_CARD.h
      }
    : { left: box.x, top: box.y, width: box.w, height: box.h }
  return (
    <div
      ref={cardRef}
      className={`cc-node cc-chat${open ? ' cc-open' : ''}`}
      data-status={chat.status}
      style={style}
      onClick={open ? undefined : onOpen}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="cc-chat-head">
        <span className="cc-dot" />
        <b>{chat.title}</b>
        <span className="cc-status">
          {chat.status === 'working' ? <span className="cc-spin" /> : null}
          {STATUS_LABEL[chat.status]}
        </span>
        {open ? (
          <>
            <button
              className="cc-head-button"
              title={translate('fork.canvas.openNormal', 'Abrir na visão normal')}
              onClick={showInNormalView}
            >
              <ExternalLink size={13} />
            </button>
            <button
              className="cc-head-button"
              title={translate('fork.canvas.closeCard', 'Fechar (Esc)')}
              onClick={onClose}
            >
              <X size={13} />
            </button>
          </>
        ) : null}
      </div>
      {open && card.ptyId ? (
        <>
          <AgentTerminalPreview
            ptyId={card.ptyId}
            terminalInput={card.terminalInput ?? null}
            className="cc-terminal"
            onRequestClose={onClose}
          />
          <CanvasVoiceBar ptyId={card.ptyId} cardRef={cardRef} />
        </>
      ) : (
        <div className="cc-feed">
          {chat.lines.length === 0 ? (
            <div className="cc-line cc-line-empty">
              {translate('fork.canvas.noText', 'sem mensagens ainda')}
            </div>
          ) : (
            chat.lines.map((line, i) => (
              <div key={i} className={`cc-line cc-line-${line.role}`}>
                {line.role === 'user' ? '› ' : ''}
                {line.text}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
