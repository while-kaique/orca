import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentChildWorkView } from '../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import type { CanvasContextTokens } from '../../../../shared/canvas-context-tokens'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { Chat } from './canvas-chats-fixture-chats'
import { LEAF, worktree as templateWorktree } from './canvas-chats-fixture-scenario'

/** Fork: made-up projects to check where free chats sit against the hierarchy, in a fixture without real chats. */
export type FreeScenarioProject = { repo: string; name: string; color: string; chats: Chat[] }

const transcriptOf = (tab: string): string => `C:/demo/.claude/projects/livres/${tab}.jsonl`
const folderOf = (repo: string): string => `C:/demo/${repo}`
const worktreeOf = (repo: string): string => `${repo}::${folderOf(repo)}`

export const chat = (tab: string, over: Partial<Chat> = {}): Chat => ({
  tab,
  title: tab,
  role: null,
  parent: null,
  model: 'claude-sonnet-5-5',
  state: 'done',
  prompt: 'ajuste o botão da tela',
  reply: 'Pronto, o botão está no lugar.',
  tokens: 40_000,
  ...over
})

function agentView(tab: string, name: string, index: number, now: number): AgentChildWorkView {
  return {
    id: `${tab}-agent-${index}`,
    providerId: `task-${tab}-${index}`,
    kind: 'agent',
    name,
    agentType: 'general-purpose',
    state: 'working',
    membership: 'live',
    firstObservedAt: now - 600_000,
    observedAt: now,
    stoppable: true,
    invocation: { invocationId: `spawn-${tab}-${index}`, generation: 1 }
  }
}

function hierarchyOf(folder: string, chats: readonly Chat[]): CanvasHierarchySnapshot {
  return {
    folder,
    chats: Object.fromEntries(
      chats
        .filter((c) => c.role)
        .map((c) => [
          c.tab,
          {
            id: c.tab,
            papel: c.role!,
            pai: c.parent,
            ordemId: c.order ? `o-${c.tab}` : null,
            ativo: true,
            mexidoPeloKaique: false
          }
        ])
    ),
    ordens: Object.fromEntries(
      chats
        .filter((c) => c.order)
        .map((c) => [
          `o-${c.tab}`,
          {
            id: `o-${c.tab}`,
            de: c.parent ?? 'po',
            chatId: c.tab,
            situacao: 'trabalhando' as const,
            reprovacoes: 0,
            titulo: c.order ?? ''
          }
        ])
    ),
    fila: []
  }
}

export function freeScenario(projects: readonly FreeScenarioProject[]): {
  store: Partial<AppState>
  hierarchy: CanvasHierarchySnapshot[]
  models: Record<string, string>
  tokens: CanvasContextTokens
} {
  // Fresh timestamps: the app ignores a state that is older than its freshness window.
  const now = Date.now()
  const all = projects.flatMap((p) => p.chats.map((c) => ({ project: p, chat: c })))
  const tabs = (p: FreeScenarioProject): TerminalTab[] =>
    p.chats.map((c, index) => ({
      id: c.tab,
      ptyId: null,
      worktreeId: worktreeOf(p.repo),
      title: c.title,
      customTitle: c.title,
      color: null,
      sortOrder: index,
      createdAt: now - 3_600_000 + index
    }))
  const worktrees = (p: FreeScenarioProject): Worktree => ({
    ...templateWorktree,
    id: worktreeOf(p.repo),
    repoId: p.repo,
    path: folderOf(p.repo)
  })
  const statuses = Object.fromEntries(
    all.map(({ project, chat: c }) => {
      const paneKey = `${c.tab}:${LEAF}`
      const entry: AgentStatusEntry = {
        paneKey,
        worktreeId: worktreeOf(project.repo),
        tabId: c.tab,
        agentType: 'claude',
        state: c.state,
        prompt: c.prompt,
        ...(c.reply ? { lastAssistantMessage: c.reply } : {}),
        updatedAt: now,
        stateStartedAt: now - 120_000,
        stateHistory: [],
        providerSession: { key: 'session_id', id: c.tab, transcriptPath: transcriptOf(c.tab) },
        ...(c.agents ? { children: c.agents.map((name, i) => agentView(c.tab, name, i, now)) } : {})
      }
      return [paneKey, entry]
    })
  )
  return {
    store: {
      repos: projects.map((p) => ({
        id: p.repo,
        path: folderOf(p.repo),
        displayName: p.name,
        badgeColor: p.color,
        addedAt: now,
        kind: 'git' as const
      })),
      worktreesByRepo: Object.fromEntries(projects.map((p) => [p.repo, [worktrees(p)]])),
      tabsByWorktree: Object.fromEntries(projects.map((p) => [worktreeOf(p.repo), tabs(p)])),
      ptyIdsByTabId: Object.fromEntries(
        all.map(({ project, chat: c }) => [c.tab, [`${worktreeOf(project.repo)}@@${c.tab}`]])
      ),
      agentStatusByPaneKey: statuses
    },
    hierarchy: projects.map((p) => hierarchyOf(folderOf(p.repo), p.chats)),
    models: Object.fromEntries(all.map(({ chat: c }) => [transcriptOf(c.tab), c.model])),
    tokens: Object.fromEntries(all.map(({ chat: c }) => [transcriptOf(c.tab), c.tokens]))
  }
}
