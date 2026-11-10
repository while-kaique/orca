import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { pcDeskWorkspaceSessionTitle } from '../../../../shared/pc-desk-session-title'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import { selectPcDeskChatAgentActivityFlags } from '../sidebar/pc-desk-switcher/pc-desk-chat-agent-activity'
import { selectWorktreeHasUnseenDone } from '../sidebar/pc-desk-switcher/worktree-unseen-done'
import { useWorktreeActivityStatus } from '../sidebar/workspace-card/activity/use-worktree-activity-status'
import type {
  CanvasAgent,
  CanvasChat,
  CanvasChatStatus,
  CanvasProject
} from './canvas-chats-layout'

type CanvasInputs = Pick<
  AppState,
  | 'repos'
  | 'tabsByWorktree'
  | 'unifiedTabsByWorktree'
  | 'ptyIdsByTabId'
  | 'agentStatusByPaneKey'
  | 'retainedAgentsByPaneKey'
  | 'acknowledgedAgentsByPaneKey'
  | 'migrationUnsupportedByPtyId'
> & { worktreesByRepo: AppState['worktreesByRepo'] }

function chatStatus(state: CanvasInputs, worktreeId: string, tabId: string): CanvasChatStatus {
  const flags = selectPcDeskChatAgentActivityFlags(state as never, worktreeId, tabId)
  if (flags.hasPermission) {
    return 'waiting'
  }
  if (flags.hasLiveWorking || flags.hasLiveMonitoring) {
    return 'working'
  }
  if (flags.hasLiveDone || flags.hasRetainedDone || flags.hasRetainedFailed || flags.hasFailed) {
    return selectWorktreeHasUnseenDone(state, worktreeId, tabId) ? 'unseen' : 'seen'
  }
  return 'idle'
}

/** Newest status entry (live first, then retained) for one chat tab. */
function latestEntry(
  state: CanvasInputs,
  tabId: string
): { paneKey: string; entry: AgentStatusEntry } | null {
  let best: { paneKey: string; entry: AgentStatusEntry } | null = null
  const consider = (paneKey: string, entry: AgentStatusEntry | undefined): void => {
    if (!entry || parseAgentStatusPaneIdentity(paneKey)?.tabId !== tabId) {
      return
    }
    if (!best || entry.stateStartedAt > best.entry.stateStartedAt) {
      best = { paneKey, entry }
    }
  }
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    consider(paneKey, entry)
  }
  for (const [paneKey, retained] of Object.entries(state.retainedAgentsByPaneKey ?? {})) {
    consider(paneKey, retained.entry)
  }
  return best
}

function subagentStatus(state: string): { status: CanvasChatStatus; blocked: boolean } {
  if (state === 'waiting' || state === 'blocked') {
    return { status: 'idle', blocked: true }
  }
  if (state === 'working') {
    return { status: 'working', blocked: false }
  }
  return { status: 'seen', blocked: false }
}

/** Same chats as the PC-desk sidebar: every open chat tab of every workspace, grouped by project. */
export function buildCanvasProjects(state: CanvasInputs): CanvasProject[] {
  const projects: CanvasProject[] = []
  for (const repo of state.repos) {
    const chats: CanvasChat[] = []
    for (const worktree of state.worktreesByRepo[repo.id] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      for (const tab of state.tabsByWorktree[worktree.id] ?? []) {
        const latest = latestEntry(state, tab.id)
        const entry = latest?.entry
        const status = chatStatus(state, worktree.id, tab.id)
        const agents: CanvasAgent[] = (entry?.subagents ?? []).map((sub) => ({
          id: `${tab.id}::${sub.id}`,
          name: sub.description || sub.agentType || 'agente',
          ...subagentStatus(sub.state),
          card: null
        }))
        const lines: CanvasChat['lines'] = []
        if (entry?.prompt) {
          lines.push({ role: 'user', text: entry.prompt })
        }
        const reply = entry?.lastAssistantMessage || entry?.lastCompletedAssistantMessage
        if (reply) {
          lines.push({ role: 'agent', text: reply })
        }
        chats.push({
          key: tab.id,
          projectId: repo.id,
          worktreeId: worktree.id,
          cwd: worktree.path,
          tabId: tab.id,
          paneKey: latest?.paneKey ?? null,
          ptyId: state.ptyIdsByTabId[tab.id]?.[0] ?? tab.ptyId ?? null,
          title:
            pcDeskWorkspaceSessionTitle([tab]) ||
            tab.title ||
            worktree.displayName ||
            repo.displayName,
          // Agents never ask the user directly: a stuck agent turns its chat red.
          status: agents.some((a) => a.blocked) ? 'waiting' : status,
          lines,
          agents,
          startedAt: entry?.stateStartedAt ?? 0
        })
      }
    }
    if (chats.length > 0) {
      projects.push({ id: repo.id, name: repo.displayName, detail: '', chats })
    }
  }
  return projects
}

export function useCanvasProjects(): CanvasProject[] {
  const inputs = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      worktreesByRepo: selectWorktreesByRepo(s),
      tabsByWorktree: s.tabsByWorktree,
      unifiedTabsByWorktree: s.unifiedTabsByWorktree,
      ptyIdsByTabId: s.ptyIdsByTabId,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      retainedAgentsByPaneKey: s.retainedAgentsByPaneKey,
      acknowledgedAgentsByPaneKey: s.acknowledgedAgentsByPaneKey,
      migrationUnsupportedByPtyId: s.migrationUnsupportedByPtyId
    }))
  )
  return useMemo(() => buildCanvasProjects(inputs), [inputs])
}

/** The card's border follows the exact same rule as the chat's dot in the sidebar. */
export function useCanvasChatStatus(chat: CanvasChat): CanvasChatStatus {
  const sidebarStatus = useWorktreeActivityStatus(chat.worktreeId, chat.tabId)
  const unseen = useAppStore((s) => selectWorktreeHasUnseenDone(s, chat.worktreeId, chat.tabId))
  if (chat.agents.some((agent) => agent.blocked) || sidebarStatus === 'permission') {
    return 'waiting'
  }
  if (sidebarStatus === 'working' || sidebarStatus === 'monitoring') {
    return 'working'
  }
  if (sidebarStatus === 'done' || sidebarStatus === 'failed' || sidebarStatus === 'interrupted') {
    return unseen ? 'unseen' : 'seen'
  }
  return 'idle'
}
