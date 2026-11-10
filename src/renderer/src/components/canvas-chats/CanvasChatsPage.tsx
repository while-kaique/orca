import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import { useCanvasProjects } from './canvas-chats-data'
import {
  busPath,
  elbowPath,
  layoutCanvas,
  type CanvasBox,
  type CanvasChat
} from './canvas-chats-layout'
import { AgentNode, ChatNode, ProjectNode, STATUS_LABEL } from './CanvasChatsNodes'
import { finishActiveCanvasVoice, useCanvasListenMode } from './canvas-voice-preference'
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
    .map((p) => `${p.id}:${p.chats.map((c) => `${c.key}/${c.agents.length}`).join(',')}`)
    .join('|')
  const layout = useMemo(
    () => layoutCanvas(projects, viewport),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey, layoutVersion, viewport.w > 0]
  )

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

  const openCard = useCallback(
    (chat: CanvasChat) => {
      const box = layout.boxes[chat.key]
      if (!box) {
        return
      }
      if (!openKey) {
        savedViewRef.current = view
      } else if (openKey !== chat.key) {
        void finishActiveCanvasVoice('send')
      }
      setOpenKey(chat.key)
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
    [layout, openKey, view, viewport, animateTo, openSize.h]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && openKey) {
        // Capture phase: Esc must not reach the chat's terminal (it would interrupt the agent).
        e.preventDefault()
        e.stopPropagation()
        closeCard('type')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openKey, closeCard])

  const reorganize = (): void => {
    if (openKey) {
      setOpenKey(null)
      savedViewRef.current = null
    }
    setLayoutVersion((v) => v + 1)
    animateTo(fitView(layoutCanvas(projects, viewport).bounds, viewport))
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) {
      return
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

  const lines: React.JSX.Element[] = []
  for (const project of projects) {
    const pbox = layout.boxes[`project:${project.id}`]
    for (const chat of project.chats) {
      const cbox = layout.boxes[chat.key]
      if (pbox && cbox) {
        lines.push(<path key={`b-${chat.key}`} className="cc-line-tree" d={busPath(pbox, cbox)} />)
      }
      for (const agent of chat.agents) {
        const abox = layout.boxes[agent.id]
        if (cbox && abox) {
          lines.push(
            <path key={`e-${agent.id}`} className="cc-line-tree" d={elbowPath(cbox, abox)} />
          )
        }
      }
    }
  }

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
        <svg className="cc-lines" width="1" height="1">
          {lines}
        </svg>
        {projects.map((project) => {
          const pbox = layout.boxes[`project:${project.id}`]
          return (
            <div key={project.id}>
              {pbox ? <ProjectNode project={project} box={pbox} /> : null}
              {project.chats.map((chat) => {
                const cbox = layout.boxes[chat.key]
                return cbox ? (
                  <div key={chat.key}>
                    <ChatNode
                      chat={chat}
                      box={cbox}
                      open={openKey === chat.key}
                      onOpen={() => openCard(chat)}
                      onClose={() => closeCard('type')}
                      openSize={openSize}
                      terminalReady={terminalReady}
                    />
                    {chat.agents.map((agent) => {
                      const abox = layout.boxes[agent.id]
                      return abox ? <AgentNode key={agent.id} agent={agent} box={abox} /> : null
                    })}
                  </div>
                ) : null
              })}
            </div>
          )
        })}
      </div>
      {projects.length === 0 ? (
        <div className="cc-empty">
          {translate('fork.canvas.empty', 'Nenhum chat aberto ainda.')}
        </div>
      ) : null}
      <div className="cc-legend" onPointerDown={(e) => e.stopPropagation()}>
        {(['idle', 'working', 'unseen', 'seen', 'waiting'] as const).map((s) => (
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
      <button className="cc-tidy" onPointerDown={(e) => e.stopPropagation()} onClick={reorganize}>
        <RotateCcw size={13} />
        {translate('fork.canvas.reorganize', 'Reorganizar')}
      </button>
    </div>
  )
}
