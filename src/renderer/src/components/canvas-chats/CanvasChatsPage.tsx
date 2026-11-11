import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { requestBackgroundTerminalWorktreeMount } from '../terminal/background-terminal-worktree-mount'
import {
  WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT,
  type WakeHibernatedAgentsWorktreeDetail
} from '@/constants/terminal'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import { useCanvasProjects } from './canvas-chats-data'
import {
  chatDescendants,
  layoutCanvas,
  type CanvasBox,
  type CanvasChat,
  type CanvasExtra
} from './canvas-chats-layout'
import { canvasChatTreeLines } from './CanvasChatTreeLines'
import { CanvasUserQueue } from './CanvasUserQueue'
import { AgentNode, ChatNode, ProjectNode, STATUS_LABEL } from './CanvasChatsNodes'
import { finishActiveCanvasVoice, useCanvasListenMode } from './canvas-voice-preference'
import {
  applyCanvasOffsets,
  clearCanvasOffsets,
  readCanvasOffsets,
  setCanvasOffsets,
  useCanvasOffsets
} from './canvas-chats-offsets'
import { useCanvasCordLayer } from './use-canvas-cord-layer'
import { CanvasWebPreview, ExtraNode } from './CanvasChatExtras'
import { CanvasAddProjectButton } from './CanvasAddProjectButton'
import './canvas-chats.css'

type View = { x: number; y: number; s: number }

function fitView(bounds: CanvasBox, viewport: { w: number; h: number }, pad = 60): View {
  if (bounds.w === 0 || viewport.w === 0) {
    return { x: 0, y: 0, s: 1 }
  }
  const s = Math.min((viewport.w - 2 * pad) / bounds.w, (viewport.h - 2 * pad) / bounds.h, 1)
  return {
    s,
    x: viewport.w / 2 - (bounds.x + bounds.w / 2) * s,
    y: viewport.h / 2 - (bounds.y + bounds.h / 2) * s
  }
}

export default function CanvasChatsPage(): React.JSX.Element {
  const projects = useCanvasProjects()
  const rootRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 })
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [expandedExtra, setExpandedExtra] = useState<CanvasExtra | null>(null)
  const savedViewRef = useRef<View | null>(null)
  const fittedRef = useRef(false)
  const animRef = useRef(0)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setViewport({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Layout is recomputed on demand (first load / Reorganizar) so cards don't jump while you look at them.
  const [layoutVersion, setLayoutVersion] = useState(0)
  const structureKey = projects
    .map(
      (p) =>
        `${p.id}:${p.chats.map((c) => `${c.key}/${c.parentKey ?? ''}/${c.agents.length}/${c.extras.length}`).join(',')}`
    )
    .join('|')
  const layout = useMemo(
    () => layoutCanvas(projects, viewport),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey, layoutVersion, viewport.w > 0]
  )
  const offsets = useCanvasOffsets()
  const boxes = useMemo(() => applyCanvasOffsets(layout.boxes, offsets), [layout, offsets])
  const justDraggedRef = useRef(false)
  /** Drag a group of cards; a press without movement stays a click. */
  const startCardDrag = (keys: readonly string[], e: React.PointerEvent): void => {
    if (e.button !== 0) {
      return
    }
    e.stopPropagation()
    const sx = e.clientX
    const sy = e.clientY
    const start = readCanvasOffsets()
    let moved = false
    justDraggedRef.current = false
    const move = (ev: PointerEvent): void => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) {
        return
      }
      moved = true
      justDraggedRef.current = true
      setCanvasOffsets(start, keys, (ev.clientX - sx) / view.s, (ev.clientY - sy) / view.s)
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const viewRef = useRef(view)
  viewRef.current = view
  const animateTo = useCallback((target: View, ms = 380) => {
    cancelAnimationFrame(animRef.current)
    const start = performance.now()
    const from = viewRef.current
    const step = (t: number): void => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - (1 - k) ** 3
      setView({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        s: from.s + (target.s - from.s) * e
      })
      if (k < 1) {
        animRef.current = requestAnimationFrame(step)
      }
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    if (!fittedRef.current && viewport.w > 0 && layout.bounds.w > 0) {
      fittedRef.current = true
      setView(fitView(layout.bounds, viewport))
    }
  }, [layout, viewport])

  const listenMode = useCanvasListenMode()
  // Big enough that the chat's terminal fits without spilling out of the card.
  const openSize = {
    w: Math.round(Math.min(1100, Math.max(640, viewport.w - 160))),
    h: Math.round(Math.min(780, Math.max(460, viewport.h - 140)))
  }
  // The live terminal mounts after the zoom settles, so it measures its box at real size.
  const [terminalReady, setTerminalReady] = useState(false)
  /**
   * After a restart Orca keeps a chat asleep until its pane is shown. Opening a card wakes just that chat in
   * the background; the card shows "Restaurando o chat…" until its terminal is live and drawn.
   */
  const wakeChat = (chat: CanvasChat, terminalIsGone = false): void => {
    const state = useAppStore.getState()
    // A saved terminal id after a restart is only a hint; the card says when it found no terminal behind it.
    if (!terminalIsGone && (state.ptyIdsByTabId[chat.tabId]?.length ?? 0) > 0) {
      return
    }
    // Orca's own background wake, aimed at this one chat: mount its pane hidden, then wake it if it was held asleep.
    requestBackgroundTerminalWorktreeMount({ worktreeId: chat.worktreeId, tabIds: [chat.tabId] })
    window.dispatchEvent(
      new CustomEvent<WakeHibernatedAgentsWorktreeDetail>(WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT, {
        detail: { worktreeId: chat.worktreeId, tabIds: [chat.tabId], wokenClaimKeys: new Set() }
      })
    )
  }
  useEffect(() => {
    setTerminalReady(false)
    if (!openKey) {
      return
    }
    const timer = setTimeout(() => setTerminalReady(true), 450)
    return () => clearTimeout(timer)
  }, [openKey])

  /** Esc/✕ keep what the mic heard written in the chat; clicking outside sends it right away. */
  const closeCard = useCallback(
    (voice: 'send' | 'type' = 'type') => {
      void finishActiveCanvasVoice(voice)
      setOpenKey(null)
      if (savedViewRef.current) {
        animateTo(savedViewRef.current)
        savedViewRef.current = null
      }
    },
    [animateTo]
  )

  // The open chat was closed (its ✕, the sidebar, or the agent exited): leave the open view too.
  useEffect(() => {
    if (openKey && !projects.some((project) => project.chats.some((c) => c.key === openKey))) {
      closeCard('type')
    }
  }, [openKey, projects, closeCard])

  const openCard = useCallback(
    (chat: CanvasChat) => {
      const box = boxes[chat.key]
      if (!box) {
        return
      }
      if (!openKey) {
        savedViewRef.current = view
      } else if (openKey !== chat.key) {
        void finishActiveCanvasVoice('send')
      }
      setOpenKey(chat.key)
      wakeChat(chat)
      // Opening a chat counts as seeing it and the agents it finished (their results land in the chat).
      const state = useAppStore.getState()
      const paneKeys = [
        ...Object.keys(state.agentStatusByPaneKey),
        ...Object.keys(state.retainedAgentsByPaneKey ?? {})
      ].filter((paneKey) => parseAgentStatusPaneIdentity(paneKey)?.tabId === chat.tabId)
      if (paneKeys.length > 0) {
        state.acknowledgeAgents(paneKeys, undefined, 'explicit')
      }
      // Scale 1 keeps the live terminal crisp and mouse-accurate.
      animateTo({
        s: 1,
        x: viewport.w / 2 - (box.x + box.w / 2),
        y: viewport.h / 2 - (box.y + openSize.h / 2)
      })
    },
    [boxes, openKey, view, viewport, animateTo, openSize.h]
  )

  const reorganize = (): void => {
    if (openKey) {
      setOpenKey(null)
      savedViewRef.current = null
    }
    setLayoutVersion((v) => v + 1)
    clearCanvasOffsets()
    animateTo(fitView(layoutCanvas(projects, viewport).bounds, viewport))
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) {
      return
    }
    if (expandedExtra) {
      setExpandedExtra(null)
    }
    const sx = e.clientX
    const sy = e.clientY
    const origin = view
    let moved = false
    const move = (ev: PointerEvent): void => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) {
        return
      }
      moved = true
      cancelAnimationFrame(animRef.current)
      setView({ ...origin, x: origin.x + ev.clientX - sx, y: origin.y + ev.clientY - sy })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!moved && openKey) {
        closeCard('send')
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onWheel = (e: React.WheelEvent): void => {
    if ((e.target as HTMLElement).closest('.cc-open')) {
      return
    }
    const rect = rootRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    cancelAnimationFrame(animRef.current)
    setView((v) => {
      const s = Math.min(2.5, Math.max(0.2, v.s * Math.exp(-e.deltaY * 0.0015)))
      return { s, x: mx - ((mx - v.x) * s) / v.s, y: my - ((my - v.y) * s) / v.s }
    })
  }

  const cordLayer = useCanvasCordLayer({ boxes, view, rootRef })

  const lines = canvasChatTreeLines(projects, boxes)

  return (
    <div
      ref={rootRef}
      className={`cc-board${openKey ? ' cc-dim' : ''}`}
      style={{
        backgroundSize: `${22 * view.s}px ${22 * view.s}px`,
        backgroundPosition: `${view.x}px ${view.y}px`
      }}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      <div
        className="cc-world"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
      >
        <svg className="cc-lines" width="20000" height="20000">
          <g transform="translate(5000 5000)">
            {lines}
            {cordLayer.paths}
          </g>
        </svg>
        {cordLayer.cutButton}
        {projects.map((project) => {
          const pbox = boxes[`project:${project.id}`]
          return (
            <div key={project.id} style={{ '--cc-pc': project.color } as React.CSSProperties}>
              {pbox ? (
                <ProjectNode
                  project={project}
                  box={pbox}
                  onDragStart={(e) =>
                    startCardDrag(
                      [
                        `project:${project.id}`,
                        ...project.chats.flatMap((c) => [c.key, ...c.agents.map((a) => a.id)])
                      ],
                      e
                    )
                  }
                />
              ) : null}
              {project.chats.map((chat) => {
                const cbox = boxes[chat.key]
                return cbox ? (
                  <div key={chat.key}>
                    <ChatNode
                      chat={chat}
                      box={cbox}
                      open={openKey === chat.key}
                      onOpen={() => {
                        if (!justDraggedRef.current) {
                          openCard(chat)
                        }
                      }}
                      onWake={() => wakeChat(chat, true)}
                      onDragStart={(e) =>
                        startCardDrag(
                          [chat, ...chatDescendants(project.chats, chat.key)].flatMap((c) => [
                            c.key,
                            ...c.agents.map((a) => a.id)
                          ]),
                          e
                        )
                      }
                      openSize={openSize}
                      terminalReady={terminalReady}
                      linkRole={
                        cordLayer.linkDrag?.target === chat.key
                          ? 'target'
                          : cordLayer.linkDrag?.from === chat.key
                            ? 'source'
                            : null
                      }
                      onStartLink={(e) => cordLayer.startLink(chat.key, e)}
                    />
                    {chat.agents.map((agent) => {
                      const abox = boxes[agent.id]
                      return abox ? <AgentNode key={agent.id} agent={agent} box={abox} /> : null
                    })}
                    {chat.extras.map((extra) => {
                      const xbox = boxes[extra.id]
                      return xbox ? (
                        <ExtraNode
                          key={extra.id}
                          extra={extra}
                          box={xbox}
                          turnKey={chat.status === 'working' ? '' : `${chat.startedAt}`}
                          onExpand={() => setExpandedExtra(extra)}
                        />
                      ) : null
                    })}
                  </div>
                ) : null
              })}
            </div>
          )
        })}
      </div>
      {expandedExtra ? (
        <CanvasWebPreview extra={expandedExtra} onClose={() => setExpandedExtra(null)} />
      ) : null}
      {projects.length === 0 ? (
        <div className="cc-empty">
          {translate('fork.canvas.empty', 'Nenhum chat aberto ainda.')}
        </div>
      ) : null}
      <CanvasUserQueue
        projects={projects}
        onOpenChat={(key) => {
          const chat = projects.flatMap((project) => project.chats).find((c) => c.key === key)
          if (chat) {
            openCard(chat)
          }
        }}
      />
      <div className="cc-legend" onPointerDown={(e) => e.stopPropagation()}>
        {(['idle', 'working', 'monitoring', 'unseen', 'seen', 'waiting'] as const).map((s) => (
          <span key={s} data-status={s}>
            <em />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
      {listenMode ? (
        <div className="cc-listen-chip">
          <span className="cc-listen-dot" />
          {translate(
            'fork.canvas.listenOn',
            'Escuta ligada: abrir um chat já me ouve · Ctrl+E desliga'
          )}
        </div>
      ) : null}
      <div className="cc-actions">
        <CanvasAddProjectButton />
        <button className="cc-tidy" onPointerDown={(e) => e.stopPropagation()} onClick={reorganize}>
          <RotateCcw size={13} />
          {translate('fork.canvas.reorganize', 'Reorganizar')}
        </button>
      </div>
    </div>
  )
}
