import { useEffect, useRef, useState } from 'react'
import { Bot, ExternalLink, Plus, Volume2, VolumeX, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { revealTerminalPane } from '@/lib/reveal-terminal-pane'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'
import { terminalPreviewApiFor } from '../dashboard-popout/terminal-preview-api'
import { CanvasVoiceBar } from './CanvasVoiceBar'
import { useCanvasChatSummary } from './canvas-chats-summary'
import { renderCanvasMarkdown } from './canvas-chats-markdown'
import { toggleCanvasAutoVoice, useCanvasAutoVoice } from './canvas-voice-preference'
import { openPcDeskChatInRepo } from '../sidebar/pc-desk-switcher/launch-pc-desk-chat'
import type { CanvasAgent, CanvasBox, CanvasChat, CanvasProject } from './canvas-chats-layout'

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
  const autoVoice = useCanvasAutoVoice(project.id)
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
    <div className="cc-node cc-project" style={{ left: box.x, top: box.y, width: box.w }}>
      <div className="cc-project-actions" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className="cc-head-button"
          title={translate('fork.canvas.newChat', 'Novo chat neste projeto')}
          onClick={addChat}
        >
          <Plus size={14} />
        </button>
        <button
          className={`cc-head-button${autoVoice ? ' cc-on' : ''}`}
          aria-pressed={autoVoice}
          title={
            autoVoice
              ? translate(
                  'fork.canvas.voiceAutoOn',
                  'Microfone automático ligado (clique para só digitar)'
                )
              : translate(
                  'fork.canvas.voiceAutoOff',
                  'Microfone automático desligado (clique para ligar)'
                )
          }
          onClick={() => toggleCanvasAutoVoice(project.id)}
        >
          {autoVoice ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>
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
  onClose
}: {
  chat: CanvasChat
  box: CanvasBox
  open: boolean
  onOpen: () => void
  onClose: () => void
}): React.JSX.Element {
  const cardRef = useRef<HTMLDivElement>(null)
  const autoVoice = useCanvasAutoVoice(chat.projectId)
  const tail = useTerminalTail(chat.lines.length === 0 && !open ? chat.ptyId : null, chat.status)
  const lines =
    chat.lines.length > 0 ? chat.lines : tail.map((text) => ({ role: 'agent' as const, text }))
  const replyText = lines
    .filter((line) => line.role !== 'user')
    .map((line) => line.text)
    .join('\n')
  // Haiku re-summarizes only after the chat stops working, so the card doesn't churn mid-turn.
  const summary = useCanvasChatSummary(chat.tabId, chat.cwd, replyText, chat.status !== 'working')
  const lastPrompt = chat.lines.find((line) => line.role === 'user')
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
      {open && chat.ptyId ? (
        <>
          <AgentTerminalPreview
            ptyId={chat.ptyId}
            terminalInput={null}
            className="cc-terminal"
            onRequestClose={onClose}
          />
          <CanvasVoiceBar ptyId={chat.ptyId} cardRef={cardRef} autoStart={autoVoice} />
        </>
      ) : (
        <div className={`cc-feed${summary ? ' cc-feed-summary' : ''}`}>
          {summary ? (
            <>
              {lastPrompt ? (
                <div className="cc-line cc-line-user cc-clamp-1">› {lastPrompt.text}</div>
              ) : null}
              <div className="cc-summary">{renderCanvasMarkdown(summary)}</div>
            </>
          ) : lines.length === 0 ? (
            <div className="cc-line cc-line-empty">
              {translate('fork.canvas.noText', 'sem mensagens ainda')}
            </div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={`cc-line cc-line-${line.role}`}>
                {line.role === 'user' ? '› ' : ''}
                {renderCanvasMarkdown(line.text)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Drops terminal escape codes (colors, cursor moves, window titles) so only the text remains. */
function stripTerminalCodes(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    if (code !== 27) {
      out += raw[i]
      continue
    }
    const next = raw[i + 1]
    if (next === '[') {
      i += 2
      while (i < raw.length && (raw.charCodeAt(i) < 64 || raw.charCodeAt(i) > 126)) {
        i++
      }
    } else if (next === ']') {
      i += 2
      while (i < raw.length && raw.charCodeAt(i) !== 7 && raw.charCodeAt(i) !== 27) {
        i++
      }
      if (raw.charCodeAt(i) === 27) {
        i++
      }
    } else {
      i++
    }
  }
  return out
}

const FRAME_ONLY = /^[\s─━│┃╭╮╰╯┌┐└┘├┤┬┴┼═║>›?•·]*$/u
const RULE_LINE = /─{10,}/u
const AGENT_UI_LINE =
  /esc to interrupt|shift\+tab to cycle|\? for shortcuts|bypass permissions|auto mode on|\d+(\.\d+)?k context/iu

/** Conversation only: Claude's input box sits between the last two rules, with the status line below it. */
function conversationLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[│┃\r]/g, '').trim())
  const rules = lines.flatMap((line, i) => (RULE_LINE.test(line) ? [i] : []))
  const end = rules.at(-2) ?? rules.at(-1) ?? lines.length
  return lines
    .slice(0, end)
    .filter((line) => line.length > 1 && !FRAME_ONLY.test(line) && !AGENT_UI_LINE.test(line))
}

/** Last readable lines of the chat's terminal, for chats with no agent summary yet (e.g. right after a restart). */
function useTerminalTail(ptyId: string | null, refreshKey: string): string[] {
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    if (!ptyId) {
      return
    }
    let alive = true
    const api = terminalPreviewApiFor(ptyId)
    void api
      .connect(ptyId, { scrollbackRows: 60 })
      .then((result) => {
        const raw = `${result.snapshot?.scrollbackAnsi ?? ''}\n${result.snapshot?.data ?? ''}`
        const text = conversationLines(stripTerminalCodes(raw))
        if (alive) {
          setLines(text.slice(-6))
        }
      })
      .catch(() => undefined)
      .finally(() => void api.unsubscribe(ptyId).catch(() => undefined))
    return () => {
      alive = false
    }
  }, [ptyId, refreshKey])
  return lines
}
