import { useRef, useState } from 'react'
import { ExternalLink, Palette, Plus, X } from 'lucide-react'
import { DEFAULT_REPO_BADGE_COLOR, REPO_COLORS } from '../../../../shared/repo-badge-color'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { revealTerminalPane } from '@/lib/reveal-terminal-pane'
import { useTerminalTail } from './canvas-chat-terminal-tail'
import { buildFontFamily } from '@/lib/monospace-font-family'
import { savedChatPeek, usePeekTheme } from './canvas-chat-peek-screen'
import { PEEK_W, usePeek } from './use-canvas-chat-peek'
import { CanvasChatTerminal } from './CanvasChatTerminal'
import { CanvasVoiceBar } from './CanvasVoiceBar'
import { useCanvasChatSummary } from './canvas-chats-summary'
import { renderCanvasMarkdown } from './canvas-chats-markdown'
import { useCanvasListenMode } from './canvas-voice-preference'
import { useCanvasChatStatus } from './canvas-chats-data'
import { openPcDeskChatInRepo } from '../sidebar/pc-desk-switcher/launch-pc-desk-chat'
import { closePcDeskChat } from '../sidebar/pc-desk-switcher/close-pc-desk-project'
import type { CanvasBox, CanvasChat, CanvasProject } from './canvas-chats-layout'
import { canvasChatModelLabel } from './canvas-chat-model-label'
import { CanvasChatContextMeter } from './CanvasChatContextMeter'
import { CanvasExecutorCrest } from './CanvasExecutorCrest'
import { useCanvasExecutorName } from './canvas-chat-executor-name'
import { chatShape, chatVisualBox } from './canvas-chat-shape'
import { CanvasChatGate, CanvasChatRole } from './CanvasChatHierarchyBadges'
import { CanvasProjectClose } from './CanvasProjectClose'

export const STATUS_LABEL: Record<CanvasChat['status'], string> = {
  idle: translate('fork.canvas.statusIdle', 'parado'),
  working: translate('fork.canvas.statusWorking', 'trabalhando'),
  monitoring: translate('fork.canvas.statusMonitoring', 'em segundo plano'),
  unseen: translate('fork.canvas.statusUnseen', 'terminou'),
  seen: translate('fork.canvas.statusSeen', 'visto'),
  waiting: translate('fork.canvas.statusWaiting', 'precisa de você'),
  team: translate('fork.canvas.statusTeam', 'aguardando equipe')
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
      <CanvasProjectClose project={project} />
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

export function ChatNode({
  chat,
  box,
  open,
  onOpen,
  openSize,
  terminalReady,
  linkRole,
  onWake,
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
  /** Wakes just this chat when its saved terminal no longer exists (after an Orca restart). */
  onWake: () => void
  onStartLink: (e: React.PointerEvent) => void
  onDragStart: (e: React.PointerEvent) => void
}): React.JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null)
  const status = useCanvasChatStatus(chat)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const autoVoice = useCanvasListenMode()
  const peeking = usePeek(open || chat.hierarchy?.role === 'executor', cardRef)
  const livePty = useAppStore((s) => s.ptyIdsByTabId[chat.tabId]?.[0] ?? null)
  const peekTheme = usePeekTheme()
  const peekFont = useAppStore((s) => s.settings?.terminalFontFamily)
  const tail = useTerminalTail(open ? null : chat.ptyId, status, chat.tabId, peeking.on, peekTheme)
  // The agent's last reply; a chat with a prompt but no reply yet (e.g. after a restart) falls back to its terminal.
  const replyText =
    chat.lines
      .filter((line) => line.role !== 'user')
      .map((line) => line.text)
      .join('\n') || tail.clean.join('\n')
  // Haiku summarizes only when the chat is not mid-turn (done, seen, idle after a restart, background agents),
  // once per reply; a headline from an older reply is never shown.
  const summary = useCanvasChatSummary(
    chat.tabId,
    chat.cwd,
    replyText,
    status !== 'working' && status !== 'waiting',
    chat.startedAt ? String(chat.startedAt) : ''
  )
  const lastPrompt = chat.lines.find((line) => line.role === 'user')
  const executorName = useCanvasExecutorName(chat, lastPrompt?.text ?? '')
  const modelLabel = canvasChatModelLabel(chat.model)
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
  const peekLines =
    tail.peek.length > 0 ? tail.peek : savedChatPeek(lastPrompt?.text, replyText, !livePty)
  const peek = peeking.on && peekLines.length > 0
  // A planner is a slim card and an executor a hexagon, inside the same slot; open or peeking they are full cards.
  const shape = open || peek ? 'card' : chatShape(chat)
  const visual = shape === 'card' ? box : chatVisualBox(chat, box)
  const style = open
    ? {
        left: box.x + box.w / 2 - openSize.w / 2,
        top: box.y,
        width: openSize.w,
        height: openSize.h
      }
    : peek
      ? { left: box.x + box.w / 2 - PEEK_W / 2, top: box.y, width: PEEK_W, minHeight: box.h }
      : { left: visual.x, top: visual.y, width: visual.w, height: visual.h }
  return (
    <div
      ref={cardRef}
      className={`cc-node cc-chat${open ? ' cc-open' : ''}${peek ? ' cc-peek' : ''}${shape === 'card' ? '' : ` cc-shape-${shape}`}${linkRole ? ` cc-link-${linkRole}` : ''}`}
      data-chat-key={chat.key}
      data-status={status}
      style={style}
      onClick={open ? undefined : onOpen}
      onPointerOver={peeking.over}
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
      <span className="cc-xwrap" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="cc-xbtn"
          title={translate('fork.canvas.closeChat', 'Fechar este chat')}
          onClick={(e) => {
            e.stopPropagation()
            peeking.hold()
            setConfirmingClose(true)
          }}
        >
          <X size={13} />
        </button>
      </span>
      {confirmingClose ? (
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
              onClick={() => {
                setConfirmingClose(false)
                peeking.release()
              }}
            >
              {translate('fork.canvas.closeChatNo', 'Cancelar')}
            </button>
          </div>
        </div>
      ) : null}
      {shape === 'crest' ? <CanvasExecutorCrest chat={chat} name={executorName} /> : null}
      <div className="cc-chat-head">
        <div className="cc-head-row">
          <span className="cc-dot" />
          <CanvasChatRole chat={chat} />
          <b>{chat.hierarchy?.role === 'planejador' ? executorName : chat.title}</b>
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
                className="cc-head-button cc-head-close"
                title={translate('fork.canvas.closeChat', 'Fechar este chat')}
                onClick={() => setConfirmingClose(true)}
              >
                <X size={13} />
              </button>
            </>
          ) : null}
        </div>
        <div className="cc-head-row">
          <CanvasChatContextMeter transcriptPath={chat.transcriptPath} />
          {modelLabel ? (
            <span className="cc-model" data-family={modelLabel.family}>
              {modelLabel.label}
            </span>
          ) : null}
          <span className="cc-status">
            {status === 'working' ? <span className="cc-spin" /> : null}
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>
      {open ? null : <CanvasChatGate chat={chat} />}
      {open ? (
        <>
          <CanvasChatTerminal
            tabId={chat.tabId}
            livePty={livePty}
            terminalReady={terminalReady}
            background={peekTheme?.background}
            onWake={onWake}
          />
          {livePty ? (
            <CanvasVoiceBar ptyId={livePty} cardRef={cardRef} autoStart={autoVoice} />
          ) : null}
        </>
      ) : peek ? (
        <div
          className="cc-peek-body"
          style={{
            background: peekTheme?.background,
            color: peekTheme?.foreground,
            fontFamily: buildFontFamily(peekFont ?? '')
          }}
        >
          {peekLines.map((line, i) => (
            <div key={i} className="cc-peek-line">
              {line.map((span, j) => (
                <span
                  key={j}
                  style={{
                    color: span.color,
                    background: span.background,
                    fontWeight: span.bold ? 700 : undefined,
                    fontStyle: span.italic ? 'italic' : undefined,
                    opacity: span.dim ? 0.6 : undefined
                  }}
                >
                  {span.text}
                </span>
              ))}
              {line.length === 0 ? ' ' : null}
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
