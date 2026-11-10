import { useEffect, useRef, useState } from 'react'
import { Bot, ExternalLink, Palette, Plus, X } from 'lucide-react'
import { DEFAULT_REPO_BADGE_COLOR, REPO_COLORS } from '../../../../shared/repo-badge-color'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { revealTerminalPane } from '@/lib/reveal-terminal-pane'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import { useTerminalTail } from './canvas-chat-terminal-tail'
import { CanvasVoiceBar } from './CanvasVoiceBar'
import { useCanvasChatSummary } from './canvas-chats-summary'
import { renderCanvasMarkdown } from './canvas-chats-markdown'
import { useCanvasListenMode } from './canvas-voice-preference'
import { useCanvasChatStatus } from './canvas-chats-data'
import { openPcDeskChatInRepo } from '../sidebar/pc-desk-switcher/launch-pc-desk-chat'
import { closePcDeskChat } from '../sidebar/pc-desk-switcher/close-pc-desk-project'
import type { CanvasAgent, CanvasBox, CanvasChat, CanvasProject } from './canvas-chats-layout'

export const STATUS_LABEL: Record<CanvasChat['status'], string> = {
  idle: translate('fork.canvas.statusIdle', 'parado'),
  working: translate('fork.canvas.statusWorking', 'trabalhando'),
  monitoring: translate('fork.canvas.statusMonitoring', 'esperando agentes de fundo'),
  unseen: translate('fork.canvas.statusUnseen', 'terminou'),
  seen: translate('fork.canvas.statusSeen', 'visto'),
  waiting: translate('fork.canvas.statusWaiting', 'precisa de você')
}

export function ProjectNode({
  project,
  box,
  onDragStart
}: {
  project: CanvasProject
  box: CanvasBox
  onDragStart: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const [pickingColor, setPickingColor] = useState(false)
  const setColor = (badgeColor: string): void => {
    void useAppStore.getState().updateRepo(project.id, { badgeColor })
    setPickingColor(false)
  }
  const count = (s: CanvasChat['status']): number =>
    project.chats.filter((c) => c.status === s).length
  const addChat = (): void => {
    const repo = useAppStore.getState().repos.find((r) => r.id === project.id)
    if (!repo) {
      return
    }
    openPcDeskChatInRepo(repo)
    // Opening the chat activates its workspace; stay on the flowchart.
    if (useAppStore.getState().activeView !== 'canvas') {
      useAppStore.getState().openCanvasPage()
    }
  }
  const agents = project.chats.reduce((n, c) => n + c.agents.length, 0)
  return (
    <div
      className="cc-node cc-project"
      style={
        { left: box.x, top: box.y, width: box.w, '--cc-pc': project.color } as React.CSSProperties
      }
      onPointerDown={onDragStart}
    >
      <div className="cc-project-actions" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className="cc-head-button"
          title={translate('fork.canvas.projectColor', 'Cor do projeto')}
          onClick={() => setPickingColor((v) => !v)}
        >
          <Palette size={14} />
        </button>
        <button
          className="cc-head-button"
          title={translate('fork.canvas.newChat', 'Novo chat neste projeto')}
          onClick={addChat}
        >
          <Plus size={14} />
        </button>
      </div>
      {pickingColor ? (
        <div className="cc-swatches" onPointerDown={(e) => e.stopPropagation()}>
          {REPO_COLORS.filter((c) => c !== DEFAULT_REPO_BADGE_COLOR).map((c) => (
            <button
              key={c}
              type="button"
              className={`cc-swatch${c === project.color ? ' cc-swatch-on' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      ) : null}
      <div className="cc-project-name">
        <i className="cc-project-badge">{project.initials}</i>
        <span>{project.name}</span>
      </div>
      {project.detail ? <div className="cc-project-detail">{project.detail}</div> : null}
      <div className="cc-pills">
        <span className="cc-pill">
          {project.chats.length} chats · {agents} agentes
        </span>
        {(['waiting', 'working', 'monitoring', 'unseen'] as const).map((s) =>
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
    : STATUS_LABEL[agent.status]
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
  openSize,
  terminalReady,
  linkRole,
  onStartLink,
  onDragStart
}: {
  chat: CanvasChat
  box: CanvasBox
  open: boolean
  onOpen: () => void
  openSize: { w: number; h: number }
  terminalReady: boolean
  linkRole: 'source' | 'target' | null
  onStartLink: (e: React.PointerEvent) => void
  onDragStart: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null)
  const status = useCanvasChatStatus(chat)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const autoVoice = useCanvasListenMode()
  const peeking = usePeek(open)
  const tail = useTerminalTail(open ? null : chat.ptyId, status, chat.tabId, peeking.on)
  const lines =
    chat.lines.length > 0
      ? chat.lines
      : tail.clean.map((text) => ({ role: 'agent' as const, text }))
  const replyText = lines
    .filter((line) => line.role !== 'user')
    .map((line) => line.text)
    .join('\n')
  // Haiku re-summarizes only after the chat stops working, so the card doesn't churn mid-turn.
  // One headline per finished turn, made while the chat is green (finished, not seen yet).
  const summary = useCanvasChatSummary(
    chat.tabId,
    chat.cwd,
    replyText,
    status === 'unseen',
    chat.startedAt ? String(chat.startedAt) : ''
  )
  const lastPrompt = chat.lines.find((line) => line.role === 'user')
  // Wrapped terminal lines read as one paragraph; bullets and tool markers are noise on a card.
  const preview = replyText
    .split('\n')
    .map((line) => line.replace(/^[●•]\s*/u, '').trim())
    .filter(Boolean)
    .join(' ')
  const showInNormalView = (): void => {
    if (
      revealTerminalPane({
        worktreeId: chat.worktreeId,
        tabId: chat.tabId,
        leafId: null,
        executionHostId: null
      })
    ) {
      useAppStore.getState().setActiveView('terminal')
    }
  }
  const peek = peeking.on && chat.ptyId !== null && tail.peek.length > 0
  const style = open
    ? {
        left: box.x + box.w / 2 - openSize.w / 2,
        top: box.y,
        width: openSize.w,
        height: openSize.h
      }
    : peek
      ? { left: box.x + box.w / 2 - PEEK_W / 2, top: box.y, width: PEEK_W, minHeight: box.h }
      : { left: box.x, top: box.y, width: box.w, height: box.h }
  return (
    <div
      ref={cardRef}
      className={`cc-node cc-chat${open ? ' cc-open' : ''}${peek ? ' cc-peek' : ''}${linkRole ? ` cc-link-${linkRole}` : ''}`}
      data-chat-key={chat.key}
      data-status={status}
      style={style}
      onClick={open ? undefined : onOpen}
      onPointerEnter={peeking.enter}
      onPointerLeave={peeking.leave}
      onPointerDown={(e) => (open ? e.stopPropagation() : onDragStart(e))}
    >
      {open
        ? null
        : (['t', 'r', 'b', 'l'] as const).map((side) => (
            <span
              key={side}
              className={`cc-edge cc-edge-${side}`}
              title={translate('fork.canvas.dragCord', 'Puxe até outro chat para ligar')}
              onPointerDown={onStartLink}
            />
          ))}
      {open ? null : (
        <span className="cc-xwrap" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="cc-xbtn"
            title={translate('fork.canvas.closeChat', 'Fechar este chat')}
            onClick={(e) => {
              e.stopPropagation()
              setConfirmingClose(true)
            }}
          >
            <X size={13} />
          </button>
        </span>
      )}
      {confirmingClose && !open ? (
        <div
          className="cc-confirm"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <b>
            {translate('fork.canvas.closeChatAsk', 'Fechar o chat "{{name}}"?', {
              name: chat.title
            })}
          </b>
          <small>
            {chat.agents.length > 0
              ? translate('fork.canvas.closeChatAgents', 'Os agentes dele também param.')
              : translate('fork.canvas.closeChatGone', 'O chat sai da barra e do fluxograma.')}
          </small>
          <div>
            <button
              type="button"
              className="cc-confirm-ok"
              onClick={() => closePcDeskChat(chat.worktreeId, chat.tabId)}
            >
              {translate('fork.canvas.closeChatYes', 'Fechar')}
            </button>
            <button
              type="button"
              className="cc-confirm-cancel"
              onClick={() => setConfirmingClose(false)}
            >
              {translate('fork.canvas.closeChatNo', 'Cancelar')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="cc-chat-head">
        <span className="cc-dot" />
        <b>{chat.title}</b>
        <span className="cc-status">
          {status === 'working' ? <span className="cc-spin" /> : null}
          {STATUS_LABEL[status]}
        </span>
        {open ? (
          <button
            className="cc-head-button"
            title={translate('fork.canvas.openNormal', 'Abrir na visão normal')}
            onClick={showInNormalView}
          >
            <ExternalLink size={13} />
          </button>
        ) : null}
      </div>
      {open && chat.ptyId ? (
        <>
          {terminalReady ? (
            <AgentTerminalPreview
              key={chat.ptyId}
              ptyId={chat.ptyId}
              terminalInput={null}
              className="cc-terminal"
            />
          ) : (
            <div className="cc-terminal" />
          )}
          <CanvasVoiceBar ptyId={chat.ptyId} cardRef={cardRef} autoStart={autoVoice} />
        </>
      ) : peek ? (
        <div className="cc-peek-body">
          {tail.peek.map((line, i) => (
            <div key={i} className="cc-peek-line">
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div className="cc-feed cc-feed-clean">
          {lastPrompt ? <div className="cc-prompt">› {lastPrompt.text}</div> : null}
          {summary ? (
            <div className="cc-summary">{renderCanvasMarkdown(summary)}</div>
          ) : preview ? (
            <div className="cc-preview">{renderCanvasMarkdown(preview)}</div>
          ) : (
            <div className="cc-line-empty">
              {translate('fork.canvas.noText', 'sem mensagens ainda')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const PEEK_W = 560

/** Hover a closed card for a moment to peek at it live; leaving ends it at once. */
function usePeek(open: boolean): { on: boolean; enter: () => void; leave: () => void } {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return {
    on: on && !open,
    enter: () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setOn(true), 220)
    },
    leave: () => {
      clearTimeout(timer.current)
      setOn(false)
    }
  }
}
