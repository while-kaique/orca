import type { AppState } from '@/store/types'
import type { LaunchRegistration } from './canvas-chat-launch-mask'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { CanvasHierarchySnapshot } from '../../../../shared/canvas-hierarchy'
import {
  FOLDER,
  LEAF,
  NOW,
  REPO,
  SCENARIO_STORE,
  WORKTREE,
  transcript,
  worktree
} from './canvas-chats-fixture-scenario'

export type LaunchScenarioKind = 'iniciando' | 'funcoes' | 'esperando' | 'problema' | 'semPedido'

const LAUNCH_TAB = 'po-novo'
const LAUNCH_TEXT = 'Voce e o PO deste projeto. Rode: hierarquia criar-po e aguarde o briefing.'

/** A project with one PO just launched, at each point of its start-up (what the launch mask draws). */
export function launchScenario(kind: LaunchScenarioKind): {
  store: Partial<AppState>
  hierarchy: CanvasHierarchySnapshot[]
  record: LaunchRegistration
} {
  const paneKey = `${LAUNCH_TAB}:${LEAF}`
  const running = kind !== 'iniciando'
  const entry: AgentStatusEntry = {
    paneKey,
    worktreeId: WORKTREE,
    tabId: LAUNCH_TAB,
    agentType: 'claude',
    state: kind === 'funcoes' ? 'working' : 'done',
    prompt: LAUNCH_TEXT,
    // Fresh on purpose: the sidebar ignores a status older than its freshness window.
    updatedAt: Date.now(),
    stateStartedAt: Date.now() - 20_000,
    stateHistory: [],
    providerSession: {
      key: 'session_id',
      id: LAUNCH_TAB,
      transcriptPath: transcript(LAUNCH_TAB)
    }
  }
  const registered = kind === 'esperando'
  return {
    store: {
      repos: SCENARIO_STORE.repos,
      worktreesByRepo: { [REPO]: [worktree] },
      tabsByWorktree: {
        [WORKTREE]: [
          {
            id: LAUNCH_TAB,
            ptyId: null,
            worktreeId: WORKTREE,
            title: 'Terminal 1',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: NOW
          }
        ]
      },
      ptyIdsByTabId: { [LAUNCH_TAB]: [`${WORKTREE}@@${LAUNCH_TAB}`] },
      agentStatusByPaneKey: running ? { [paneKey]: entry } : {}
    },
    hierarchy: [
      {
        folder: FOLDER,
        chats: registered
          ? {
              [LAUNCH_TAB]: {
                id: LAUNCH_TAB,
                papel: 'po',
                pai: null,
                ordemId: null,
                ativo: true,
                mexidoPeloKaique: false
              }
            }
          : {},
        ordens: {},
        fila: []
      }
    ],
    record: {
      tabId: LAUNCH_TAB,
      worktreeId: WORKTREE,
      launchText: LAUNCH_TEXT,
      // The mask learns these from live agent states; a fixture has none, so it starts from them.
      seen:
        kind === 'semPedido'
          ? { runningSince: Date.now() - 125_000 }
          : kind === 'esperando' || kind === 'problema'
            ? { sawWorking: true }
            : undefined
    }
  }
}

export type FreeChatScenarioKind = 'terminal' | 'claude' | 'pronto' | 'problema'

const FREE_TAB = 'livre-novo'

/** A free chat just opened, at each point of its start-up (what the free chat's steps screen draws). */
export function freeChatScenario(kind: FreeChatScenarioKind): {
  store: Partial<AppState>
  hierarchy: CanvasHierarchySnapshot[]
  record: LaunchRegistration
} {
  const paneKey = `${FREE_TAB}:${LEAF}`
  const entry: AgentStatusEntry = {
    paneKey,
    worktreeId: WORKTREE,
    tabId: FREE_TAB,
    agentType: 'claude',
    // What Claude's SessionStart hook reports: up and waiting, no turn yet.
    state: 'done',
    prompt: '',
    updatedAt: Date.now(),
    stateStartedAt: Date.now(),
    stateHistory: [],
    providerSession: { key: 'session_id', id: FREE_TAB, transcriptPath: transcript(FREE_TAB) }
  }
  return {
    store: {
      repos: SCENARIO_STORE.repos,
      worktreesByRepo: { [REPO]: [worktree] },
      tabsByWorktree: {
        [WORKTREE]: [
          {
            id: FREE_TAB,
            ptyId: null,
            worktreeId: WORKTREE,
            title: 'Terminal 1',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: NOW
          }
        ]
      },
      ptyIdsByTabId:
        kind === 'terminal' || kind === 'problema'
          ? {}
          : { [FREE_TAB]: [`${WORKTREE}@@${FREE_TAB}`] },
      agentStatusByPaneKey: kind === 'pronto' ? { [paneKey]: entry } : {}
    },
    hierarchy: [{ folder: FOLDER, chats: {}, ordens: {}, fila: [] }],
    record: {
      kind: 'free',
      tabId: FREE_TAB,
      worktreeId: WORKTREE,
      launchText: '',
      // The mask learns the terminal from live state; a fixture has none, so the problem case starts from it.
      seen: kind === 'problema' ? { hadTerminal: true } : undefined
    }
  }
}
