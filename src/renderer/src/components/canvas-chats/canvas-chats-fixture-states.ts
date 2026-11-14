import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentChildWorkView } from '../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { worktree as baseWorktree } from './canvas-chats-fixture-scenario'

/**
 * Fork (o-044): every card state side by side, written as the host reports it, so the state rule itself
 * (not a data-status pasted on the card) decides each border. Project "Estados" holds the five cases of
 * "precisa de você"; Atendimento, Arquivo and Vitrine show a lit, a quiet and an unseen project.
 */
type Turn = 'asks' | 'done' | 'working' | 'background' | 'asksNoBackground'

type StateChat = {
  tab: string
  repo: string
  title: string
  turn: Turn
  reply: string
  seen?: true
  role?: 'po' | 'executor'
  parent?: string
}

const LEAF = '22222222-2222-4222-8222-222222222222'

export const STATE_PROJECTS = [
  { id: 'st-estados', name: 'Estados', folder: 'C:/demo/estados', color: '#f97316' },
  { id: 'st-atendimento', name: 'Atendimento', folder: 'C:/demo/atendimento', color: '#22c55e' },
  { id: 'st-arquivo', name: 'Arquivo', folder: 'C:/demo/arquivo', color: '#0ea5e9' },
  { id: 'st-vitrine', name: 'Vitrine', folder: 'C:/demo/vitrine', color: '#ec4899' }
] as const

export const STATE_CHATS: StateChat[] = [
  {
    tab: 'pede',
    repo: 'st-estados',
    title: 'Preview videos TikTok',
    turn: 'asks',
    reply: 'Plano de 5 versões pronto, falta seu OK.\n\nAprova as 5 direções e o plano?'
  },
  {
    tab: 'visto',
    repo: 'st-estados',
    title: 'README do projeto',
    turn: 'done',
    seen: true,
    reply: 'Pronto: README atualizado e commit feito.'
  },
  {
    tab: 'trab',
    repo: 'st-estados',
    title: 'Corrigir o login',
    turn: 'working',
    reply: ''
  },
  {
    tab: 'fundo',
    repo: 'st-estados',
    title: 'Treino do modelo',
    turn: 'background',
    reply: 'Treino rodando em segundo plano; aviso quando acabar.'
  },
  {
    tab: 'po',
    repo: 'st-estados',
    title: 'PO de Estados',
    turn: 'done',
    seen: true,
    role: 'po',
    reply: 'Executor lançado; sigo quando ele entregar.'
  },
  {
    tab: 'ex',
    repo: 'st-estados',
    title: 'Ajustar cores',
    turn: 'background',
    role: 'executor',
    parent: 'po',
    reply: 'Build rodando em segundo plano.'
  },
  {
    tab: 'atende',
    repo: 'st-atendimento',
    title: 'Responder tickets',
    turn: 'working',
    reply: ''
  },
  {
    tab: 'arq1',
    repo: 'st-arquivo',
    title: 'Limpar pastas antigas',
    turn: 'done',
    seen: true,
    reply: 'Pastas antigas removidas; nada pendente.'
  },
  {
    tab: 'arq2',
    repo: 'st-arquivo',
    title: 'Revisar planilha de custos',
    turn: 'done',
    seen: true,
    reply: 'Planilha revisada e salva.'
  },
  {
    tab: 'vit',
    repo: 'st-vitrine',
    title: 'Fotos da vitrine',
    turn: 'done',
    reply: 'As 12 fotos novas estão na pasta da vitrine.'
  }
]

const worktreeId = (repo: string): string =>
  `${repo}::${STATE_PROJECTS.find((p) => p.id === repo)?.folder}`

function backgroundCommand(tab: string, now: number): AgentChildWorkView {
  return {
    id: `${tab}-cmd`,
    providerId: `shell-${tab}`,
    kind: 'command',
    name: tab === 'ex' ? 'pnpm build' : 'npm run dev',
    state: 'working',
    membership: 'live',
    firstObservedAt: now - 300_000,
    observedAt: now,
    stoppable: true,
    invocation: { invocationId: `spawn-${tab}`, generation: 1 }
  }
}

function entryFor(chat: StateChat, now: number): AgentStatusEntry {
  const turnEnded = chat.turn === 'asks' || chat.turn === 'background'
  const held = chat.turn === 'asks' || chat.turn === 'background'
  return {
    paneKey: `${chat.tab}:${LEAF}`,
    worktreeId: worktreeId(chat.repo),
    tabId: chat.tab,
    agentType: 'claude',
    state: chat.turn === 'done' || chat.turn === 'asksNoBackground' ? 'done' : 'working',
    ...(held ? { workingMode: 'monitoring' as const } : {}),
    ...(turnEnded ? { mainAgent: { state: 'done', stateStartedAt: now - 60_000 } as never } : {}),
    ...(chat.role === 'executor'
      ? { orchestration: { taskId: `task_${chat.tab}`, dispatchId: `ctx_${chat.tab}` } }
      : {}),
    prompt: `pedido de ${chat.title.toLowerCase()}`,
    ...(chat.reply ? { lastAssistantMessage: chat.reply } : {}),
    updatedAt: now,
    stateStartedAt: now - 120_000,
    stateHistory: [],
    ...(held ? { children: [backgroundCommand(chat.tab, now)] } : {})
  }
}

/** `turns` overrides a chat's turn, e.g. the asking chat after the user answered. */
export function stateStore(turns: Record<string, Turn> = {}): Partial<AppState> {
  const now = Date.now()
  const chats = STATE_CHATS.map((chat) => ({ ...chat, turn: turns[chat.tab] ?? chat.turn }))
  const worktrees: Worktree[] = STATE_PROJECTS.map((project) => ({
    ...baseWorktree,
    id: worktreeId(project.id),
    repoId: project.id,
    path: project.folder
  }))
  const tabs: TerminalTab[] = chats.map((chat, index) => ({
    id: chat.tab,
    ptyId: null,
    worktreeId: worktreeId(chat.repo),
    title: chat.title,
    customTitle: chat.title,
    color: null,
    sortOrder: index,
    createdAt: now - 3_600_000 + index
  }))
  const entries = chats.map((chat) => entryFor(chat, now))
  return {
    repos: STATE_PROJECTS.map((project) => ({
      id: project.id,
      path: project.folder,
      displayName: project.name,
      badgeColor: project.color,
      addedAt: now,
      kind: 'git' as const
    })),
    worktreesByRepo: Object.fromEntries(worktrees.map((w) => [w.repoId, [w]])),
    tabsByWorktree: Object.fromEntries(
      worktrees.map((w) => [w.id, tabs.filter((tab) => tab.worktreeId === w.id)])
    ),
    ptyIdsByTabId: Object.fromEntries(chats.map((chat) => [chat.tab, [`pty-${chat.tab}`]])),
    agentStatusByPaneKey: Object.fromEntries(entries.map((entry) => [entry.paneKey, entry])),
    acknowledgedAgentsByPaneKey: Object.fromEntries(
      chats.filter((chat) => chat.seen).map((chat) => [`${chat.tab}:${LEAF}`, now])
    )
  }
}

export const STATE_HIERARCHY: CanvasHierarchySnapshot[] = [
  {
    folder: 'C:/demo/estados',
    chats: {
      po: {
        id: 'po',
        papel: 'po',
        pai: null,
        ordemId: null,
        ativo: true,
        mexidoPeloKaique: false
      },
      ex: {
        id: 'ex',
        papel: 'executor',
        pai: 'po',
        ordemId: 'o-ex',
        ativo: true,
        mexidoPeloKaique: false
      }
    },
    ordens: {
      'o-ex': {
        id: 'o-ex',
        de: 'po',
        chatId: 'ex',
        situacao: 'trabalhando',
        reprovacoes: 0,
        titulo: 'Ajustar cores'
      }
    },
    fila: []
  }
]
