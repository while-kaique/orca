import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentChildWorkView } from '../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import type { CanvasContextTokens } from '../../../../shared/canvas-context-tokens'
import type { TerminalTab } from '../../../../shared/workspace-layout/terminal-tab-types'
import type { Worktree } from '../../../../shared/worktree/types'

/**
 * Fork: a made-up project with the full chat hierarchy (one PO, two planners, four executors) and every
 * kind of attachment, to check the flowchart's look in a fixture without real chats.
 */
const REPO = 'demo-repo'
const FOLDER = 'C:/demo/loja-online'
const WORKTREE = `${REPO}::${FOLDER}`
const LEAF = '11111111-1111-4111-8111-111111111111'
const NOW = 1_794_430_000_000
const transcript = (tab: string): string => `C:/demo/.claude/projects/loja/${tab}.jsonl`

type Chat = {
  tab: string
  title: string
  role: 'po' | 'planejador' | 'executor' | null
  parent: string | null
  model: string
  state: AgentStatusEntry['state']
  prompt: string
  reply: string
  tokens: number
  order?: string
  agents?: string[]
}

const CHATS: Chat[] = [
  {
    tab: 'po',
    model: 'claude-fable-5-2',
    title: 'Mestre de Banners',
    role: 'po',
    parent: null,
    state: 'done',
    prompt: 'quero a tela de status e os pagamentos prontos',
    reply: 'Duas frentes em andamento: a tela de status e os pagamentos.',
    tokens: 156_000,
    agents: ['revisor de layout', 'pesquisa de referências']
  },
  {
    tab: 'pl1',
    model: 'claude-opus-5-5',
    title: 'Tela de status',
    role: 'planejador',
    parent: 'po',
    state: 'working',
    prompt: 'planeje a tela de status',
    reply: 'Dividi em duas tarefas independentes.',
    tokens: 302_000,
    order: 'Tela de status do pedido',
    agents: ['leitor do código']
  },
  {
    tab: 'pl2',
    model: 'claude-opus-5-5',
    title: 'Pagamentos',
    role: 'planejador',
    parent: 'po',
    state: 'done',
    prompt: 'planeje os pagamentos',
    reply: 'Esperando a entrega dos dois executores.',
    tokens: 188_000,
    order: 'Pagamentos por Pix'
  },
  {
    tab: 'ex1',
    model: 'claude-sonnet-5-5',
    title: 'Mestre UI/UX',
    role: 'executor',
    parent: 'pl1',
    state: 'working',
    prompt: 'monte a tela',
    reply: '',
    tokens: 242_000,
    order: 'Montar a tela de status'
  },
  {
    tab: 'ex2',
    model: 'claude-sonnet-5-5',
    title: 'Validador',
    role: 'executor',
    parent: 'pl1',
    state: 'done',
    prompt: 'valide a tela',
    reply: 'Tela validada nos três tamanhos.',
    tokens: 91_000,
    order: 'Validar a tela de status'
  },
  {
    tab: 'ex3',
    model: 'claude-haiku-5-5',
    title: 'Debugger',
    role: 'executor',
    parent: 'pl2',
    state: 'done',
    prompt: 'ache o erro do Pix',
    reply: 'Erro achado no cálculo do troco.',
    tokens: 84_000,
    order: 'Achar o erro do Pix'
  },
  {
    tab: 'ex4',
    model: 'claude-sonnet-5-5',
    title: 'Criador de Testes',
    role: 'executor',
    parent: 'pl2',
    state: 'working',
    prompt: 'escreva os testes',
    reply: '',
    tokens: 330_000,
    order: 'Testes do pagamento por Pix'
  },
  {
    tab: 'livre',
    model: 'claude-sonnet-5-5',
    title: 'Conversa solta',
    role: null,
    parent: null,
    state: 'done',
    prompt: 'me explica essa mensagem de erro',
    reply: 'É um erro de rede; tente de novo em alguns minutos.',
    tokens: 42_000
  }
]

function agentView(tab: string, name: string, index: number): AgentChildWorkView {
  return {
    id: `${tab}-agent-${index}`,
    providerId: `task-${tab}-${index}`,
    kind: 'agent',
    name,
    agentType: 'general-purpose',
    state: 'working',
    membership: 'live',
    firstObservedAt: NOW - 600_000,
    observedAt: NOW,
    stoppable: true,
    invocation: { invocationId: `spawn-${tab}-${index}`, generation: 1 }
  }
}

const worktree: Worktree = {
  id: WORKTREE,
  repoId: REPO,
  path: FOLDER,
  displayName: 'main',
  comment: '',
  linkedIssue: null,
  linkedPR: null,
  linkedLinearIssue: null,
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: NOW,
  head: '',
  branch: 'refs/heads/main',
  isBare: false,
  isMainWorktree: true
}

const tabs: TerminalTab[] = CHATS.map((chat, index) => ({
  id: chat.tab,
  ptyId: null,
  worktreeId: WORKTREE,
  title: chat.title,
  customTitle: chat.title,
  color: null,
  sortOrder: index,
  createdAt: NOW - 3_600_000 + index
}))

const statuses: Record<string, AgentStatusEntry> = Object.fromEntries(
  CHATS.map((chat) => {
    const paneKey = `${chat.tab}:${LEAF}`
    const entry: AgentStatusEntry = {
      paneKey,
      worktreeId: WORKTREE,
      tabId: chat.tab,
      agentType: 'claude',
      state: chat.state,
      prompt: chat.prompt,
      ...(chat.reply ? { lastAssistantMessage: chat.reply } : {}),
      updatedAt: NOW,
      stateStartedAt: NOW - 120_000,
      stateHistory: [],
      providerSession: { key: 'session_id', id: chat.tab, transcriptPath: transcript(chat.tab) },
      ...(chat.agents
        ? { children: chat.agents.map((name, index) => agentView(chat.tab, name, index)) }
        : {})
    }
    return [paneKey, entry]
  })
)

export const SCENARIO_STORE: Partial<AppState> = {
  repos: [
    {
      id: REPO,
      path: FOLDER,
      displayName: 'Loja Online',
      badgeColor: '#8b5cf6',
      addedAt: NOW,
      kind: 'git'
    }
  ],
  worktreesByRepo: { [REPO]: [worktree] },
  tabsByWorktree: { [WORKTREE]: tabs },
  // A live terminal per chat, so each card shows its state instead of "parado".
  ptyIdsByTabId: Object.fromEntries(CHATS.map((chat) => [chat.tab, [`${WORKTREE}@@${chat.tab}`]])),
  agentStatusByPaneKey: statuses,
  workspacePortScan: {
    key: 'demo',
    result: {
      platform: 'win32',
      scannedAt: NOW,
      ports: [
        {
          id: 'demo-5193',
          kind: 'workspace',
          bindHost: '127.0.0.1',
          connectHost: '127.0.0.1',
          port: 5193,
          pid: 4242,
          protocol: 'http',
          owner: {
            worktreeId: WORKTREE,
            repoId: REPO,
            displayName: 'main',
            path: FOLDER,
            confidence: 'cwd'
          }
        }
      ]
    }
  }
}

export const SCENARIO_HIERARCHY: CanvasHierarchySnapshot[] = [
  {
    folder: FOLDER,
    chats: Object.fromEntries(
      CHATS.flatMap((chat) =>
        chat.role
          ? [
              [
                chat.tab,
                {
                  id: chat.tab,
                  papel: chat.role,
                  pai: chat.parent,
                  ordemId: chat.order ? `o-${chat.tab}` : null,
                  ativo: true,
                  mexidoPeloKaique: false
                }
              ] as const
            ]
          : []
      )
    ),
    ordens: Object.fromEntries(
      CHATS.filter((chat) => chat.order).map((chat) => [
        `o-${chat.tab}`,
        {
          id: `o-${chat.tab}`,
          de: chat.parent ?? 'po',
          chatId: chat.tab,
          situacao: 'trabalhando' as const,
          reprovacoes: 0,
          titulo: chat.order ?? ''
        }
      ])
    ),
    fila: []
  }
]

/** Claude's status record has no model; the flowchart reads it from each chat's transcript. */
export const SCENARIO_MODELS: Record<string, string> = Object.fromEntries(
  CHATS.map((chat) => [transcript(chat.tab), chat.model])
)

export const SCENARIO_CONTEXT: CanvasContextTokens = Object.fromEntries(
  CHATS.map((chat) => [transcript(chat.tab), chat.tokens])
)

/** Terminal text per chat: what the flowchart reads to find artifacts, servers and image files. */
export const SCENARIO_TERMINAL_TEXT: Record<string, string> = {
  po: [
    'Publicado em https://claude.ai/artifact/CvbNp6EWRwUBzGhMNwSwUc',
    'Servidor no ar em http://localhost:5193/pedidos',
    'Read(C:\\demo\\loja-online\\saida\\banner-final.png)',
    'Read(C:\\demo\\loja-online\\saida\\selo-novo.png)',
    'Read(C:\\demo\\loja-online\\saida\\capa-do-site.png)'
  ].join('\n'),
  ex1: [
    'Read(C:\\demo\\loja-online\\prints\\tela-depois.png)',
    'Read(C:\\demo\\loja-online\\prints\\tela-antes.png)'
  ].join('\n'),
  ex4: 'Read(C:\\demo\\loja-online\\prints\\falha-do-teste.png)'
}

/** A flat picture standing in for a real screenshot: fixtures have no files to read. */
export function scenarioPicture(seed: string): string {
  const hue = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="225"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 70) % 360} 60% 58%)"/></linearGradient></defs><rect width="360" height="225" fill="url(#g)"/><rect x="24" y="24" width="150" height="16" rx="4" fill="#fff" fill-opacity=".85"/><rect x="24" y="52" width="230" height="10" rx="3" fill="#fff" fill-opacity=".45"/><rect x="24" y="70" width="190" height="10" rx="3" fill="#fff" fill-opacity=".45"/><rect x="24" y="110" width="96" height="90" rx="8" fill="#fff" fill-opacity=".22"/><rect x="132" y="110" width="96" height="90" rx="8" fill="#fff" fill-opacity=".22"/><rect x="240" y="110" width="96" height="90" rx="8" fill="#fff" fill-opacity=".22"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
