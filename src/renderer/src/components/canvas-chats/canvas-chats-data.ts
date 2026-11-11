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
import { runningChildWork } from './canvas-chat-child-work'
import type { CanvasChatLatestEntry } from './canvas-chat-lineage'
import { linkProjectChats, useCanvasHierarchy } from './canvas-chat-hierarchy'
import { projectColor, projectInitials } from './canvas-project-badge'
import { getWorkspacePortsByWorktreeId } from '@/lib/workspace-ports/workspace-port-groups'
import { browserUrlForPort } from '@/lib/workspace-ports/workspace-port-urls'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import {
  artifactLinksForTab,
  pageForPort,
  portsMentionedByTab,
  useCanvasArtifactLinks,
  type CanvasArtifactLinks
} from './canvas-chat-artifacts'
import type { CanvasExtra } from './canvas-chats-layout'

/** Servers whose URL this chat's terminal printed, plus the claude.ai artifacts it showed. */
function chatExtras(
  state: CanvasInputs,
  ports: readonly WorkspacePort[],
  tabId: string,
  ptyIds: readonly string[],
  allPorts: readonly WorkspacePort[],
  owner: { repoId: string; worktreeId: string }
): CanvasExtra[] {
  const extras: CanvasExtra[] = []
  const mentioned = portsMentionedByTab(state.artifactLinks, tabId)
  const seen = new Set<number>()
  const push = (port: WorkspacePort, repoId: string, worktreeId: string): void => {
    if (seen.has(port.port)) {
      return
    }
    seen.add(port.port)
    const url = pageForPort(state.artifactLinks, tabId, port.port) ?? browserUrlForPort(port)
    extras.push({
      id: `${tabId}::server:${port.port}`,
      kind: 'server',
      label: url.replace(/^https?:\/\//u, ''),
      url,
      ...(port.pid ? { server: { repoId, worktreeId, pid: port.pid, port: port.port } } : {})
    })
  }
  for (const port of ports) {
    // Tied to this chat when its terminal printed the URL, or the conversation mentions the port.
    if (port.kind !== 'workspace') {
      continue
    }
    const printedHere =
      port.advertisedByPtyId !== undefined && ptyIds.includes(port.advertisedByPtyId)
    if (printedHere || mentioned.includes(port.port)) {
      push(port, port.owner.repoId, port.owner.worktreeId)
    }
  }
  // Folder workspaces (e.g. Desktop\Projetos) get no port owner from Orca: match mentioned ports machine-wide.
  for (const port of allPorts) {
    if (mentioned.includes(port.port) && port.kind !== 'container') {
      push(port, owner.repoId, owner.worktreeId)
    }
  }
  for (const url of artifactLinksForTab(state.artifactLinks, tabId)) {
    extras.push({
      id: `${tabId}::artifact:${url}`,
      kind: 'artifact',
      label: `artifact ${url.split('/').pop()?.slice(0, 10) ?? ''}`,
      url
    })
  }
  return extras
}

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
  | 'workspacePortScan'
  | 'sleepingAgentSessionsByPaneKey'
> & {
  worktreesByRepo: AppState['worktreesByRepo']
  artifactLinks: CanvasArtifactLinks
  hierarchy: ReturnType<typeof useCanvasHierarchy>
}

function chatStatus(state: CanvasInputs, worktreeId: string, tabId: string): CanvasChatStatus {
  const flags = selectPcDeskChatAgentActivityFlags(state as never, worktreeId, tabId)
  if (flags.hasPermission) {
    return 'waiting'
  }
  if (flags.hasLiveWorking) {
    return 'working'
  }
  if (flags.hasLiveMonitoring) {
    return 'monitoring'
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

/** A chat put to sleep (e.g. Orca reopened) keeps its last prompt and reply in its sleep record. */
function sleepingRecord(
  state: CanvasInputs,
  tabId: string
): { prompt: string; lastAssistantMessage?: string } | null {
  let best: CanvasInputs['sleepingAgentSessionsByPaneKey'][string] | null = null
  for (const record of Object.values(state.sleepingAgentSessionsByPaneKey ?? {})) {
    if (record.tabId === tabId && (!best || record.updatedAt > best.updatedAt)) {
      best = record
    }
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
  if (state === 'monitoring') {
    return { status: 'monitoring', blocked: false }
  }
  return { status: 'seen', blocked: false }
}

/** Same chats as the PC-desk sidebar: every open chat tab of every workspace, grouped by project. */
export function buildCanvasProjects(state: CanvasInputs): CanvasProject[] {
  const projects: CanvasProject[] = []
  const portsByWorktree = getWorkspacePortsByWorktreeId(state.workspacePortScan?.result)
  for (const repo of state.repos) {
    const chats: CanvasChat[] = []
    const latestByChat = new Map<string, CanvasChatLatestEntry>()
    for (const worktree of state.worktreesByRepo[repo.id] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      for (const tab of state.tabsByWorktree[worktree.id] ?? []) {
        const latest = latestEntry(state, tab.id)
        const entry = latest?.entry
        if (latest) {
          latestByChat.set(tab.id, latest)
        }
        const status = chatStatus(state, worktree.id, tab.id)
        // Same records as the sidebar, plus background commands (e.g. a training left running).
        const agents: CanvasAgent[] = entry
          ? runningChildWork(entry).map((row) => {
              const task = row.kind !== 'agent'
              return {
                id: `${tab.id}::${row.id}`,
                kind: task ? ('task' as const) : ('agent' as const),
                name: row.name || row.agentType || (task ? 'processo em segundo plano' : 'agente'),
                // A background command is never "the chat working": it runs on its own.
                ...(task && row.displayState === 'working'
                  ? { status: 'monitoring' as const, blocked: false }
                  : subagentStatus(row.displayState)),
                card: null
              }
            })
          : []
        const lines: CanvasChat['lines'] = []
        const asleep = entry ? null : sleepingRecord(state, tab.id)
        const prompt = entry?.prompt || asleep?.prompt
        if (prompt) {
          lines.push({ role: 'user', text: prompt })
        }
        const reply =
          entry?.lastAssistantMessage ||
          entry?.lastCompletedAssistantMessage ||
          asleep?.lastAssistantMessage
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
          parentKey: null,
          model: entry?.model?.trim() || null,
          hierarchy: null,
          // Agents never ask the user directly: a stuck agent turns its chat red.
          status: agents.some((a) => a.blocked) ? 'waiting' : status,
          lines,
          agents,
          extras: chatExtras(
            state,
            portsByWorktree.get(worktree.id) ?? [],
            tab.id,
            state.ptyIdsByTabId[tab.id] ?? (tab.ptyId ? [tab.ptyId] : []),
            state.workspacePortScan?.result?.ports ?? [],
            { repoId: repo.id, worktreeId: worktree.id }
          ),
          startedAt: entry?.stateStartedAt ?? 0
        })
      }
    }
    const folders = (state.worktreesByRepo[repo.id] ?? []).map((w) => w.path)
    const queue = linkProjectChats(chats, latestByChat, state.hierarchy, folders)
    if (chats.length > 0) {
      projects.push({
        id: repo.id,
        name: repo.displayName,
        color: projectColor(repo.id, repo.badgeColor),
        initials: projectInitials(repo.displayName),
        detail: '',
        chats,
        queue
      })
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
      migrationUnsupportedByPtyId: s.migrationUnsupportedByPtyId,
      workspacePortScan: s.workspacePortScan,
      sleepingAgentSessionsByPaneKey: s.sleepingAgentSessionsByPaneKey
    }))
  )
  const artifactLinks = useCanvasArtifactLinks()
  const folders = useMemo(
    () =>
      Object.values(inputs.worktreesByRepo)
        .flat()
        .filter((worktree) => !worktree.isArchived)
        .map((worktree) => worktree.path),
    [inputs.worktreesByRepo]
  )
  const hierarchy = useCanvasHierarchy(folders)
  return useMemo(
    () => buildCanvasProjects({ ...inputs, artifactLinks, hierarchy }),
    [inputs, artifactLinks, hierarchy]
  )
}

/** The card's border follows the exact same rule as the chat's dot in the sidebar. */
export function useCanvasChatStatus(chat: CanvasChat): CanvasChatStatus {
  const sidebarStatus = useWorktreeActivityStatus(chat.worktreeId, chat.tabId)
  const unseen = useAppStore((s) => selectWorktreeHasUnseenDone(s, chat.worktreeId, chat.tabId))
  if (chat.agents.some((agent) => agent.blocked) || sidebarStatus === 'permission') {
    return 'waiting'
  }
  if (sidebarStatus === 'working') {
    return 'working'
  }
  if (sidebarStatus === 'monitoring') {
    return 'monitoring'
  }
  if (sidebarStatus === 'done' || sidebarStatus === 'failed' || sidebarStatus === 'interrupted') {
    return unseen ? 'unseen' : 'seen'
  }
  return 'idle'
}
