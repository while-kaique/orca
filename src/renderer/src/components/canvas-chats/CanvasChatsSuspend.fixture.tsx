import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AppState } from '@/store/types'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-resume'
import { WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT } from '@/constants/terminal'
import CanvasChatsPage from './CanvasChatsPage'
import { CanvasChatCloseDialog } from './CanvasChatCloseDialog'
import { noteCanvasChatArtifacts } from './canvas-chat-artifacts'
import {
  LEAF,
  NOW,
  SCENARIO_CONTEXT,
  SCENARIO_HIERARCHY,
  SCENARIO_MODELS,
  SCENARIO_TERMINAL_TEXT,
  WORKTREE,
  scenarioPicture,
  scenarioStoreWithStates,
  transcript
} from './canvas-chats-fixture-scenario'

/**
 * Fork: the suspend and close choices of a chat card, drawn from the made-up project. A suspended chat is a
 * card with a saved resume record and no live terminal, exactly what the app's own data rule looks for.
 */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const LONG_TITLE = 'Mestre de Banners da campanha de Dia das Mães com todas as variações'

const board = (): React.JSX.Element => (
  <div style={{ display: 'flex', height: 860 }}>
    <CanvasChatsPage />
  </div>
)

function setup(): void {
  window.api.repos.readCanvasHierarchy = () => Promise.resolve(SCENARIO_HIERARCHY)
  window.api.repos.readCanvasContextTokens = () => Promise.resolve(SCENARIO_CONTEXT)
  window.api.repos.readCanvasChatModels = () => Promise.resolve(SCENARIO_MODELS)
  window.api.repos.captureCanvasPagePreview = (url) =>
    Promise.resolve({ kind: 'ok', dataUrl: scenarioPicture(url) })
  window.api.repos.readCanvasImage = ({ path }) =>
    Promise.resolve({ kind: 'ok', dataUrl: scenarioPicture(path) })
  for (const [tab, text] of Object.entries(SCENARIO_TERMINAL_TEXT)) {
    noteCanvasChatArtifacts(tab, text)
  }
}

async function tidy(frame: HTMLElement): Promise<void> {
  await wait(400)
  frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
  await wait(700)
}

/** The hover buttons only show under the mouse: a still picture needs them forced on. */
function showHoverButtons(frame: HTMLElement): void {
  for (const button of frame.querySelectorAll<HTMLElement>('.cc-chat .cc-xbtn')) {
    button.setAttribute('style', 'opacity:1;transform:none')
  }
}

/** The chats `tabs` stopped on purpose: their status rows are gone, their conversation is kept, no terminal. */
function suspendedStore(tabs: string[], longTitle = false): Partial<AppState> {
  const base = scenarioStoreWithStates({})
  const records: Record<string, SleepingAgentSessionRecord> = {}
  const statuses = { ...base.agentStatusByPaneKey }
  const ptys = { ...base.ptyIdsByTabId }
  for (const tab of tabs) {
    const paneKey = `${tab}:${LEAF}`
    const entry = statuses[paneKey]
    delete statuses[paneKey]
    delete ptys[tab]
    records[paneKey] = {
      paneKey,
      tabId: tab,
      worktreeId: entry?.worktreeId ?? WORKTREE,
      agent: 'claude',
      providerSession: { key: 'session_id', id: tab, transcriptPath: transcript(tab) },
      prompt: entry?.prompt ?? '',
      state: 'working',
      capturedAt: NOW,
      updatedAt: NOW,
      ...(entry?.lastAssistantMessage ? { lastAssistantMessage: entry.lastAssistantMessage } : {}),
      origin: 'worktree-sleep',
      restoreOnTabOpenOnly: true
    }
  }
  const tabsByWorktree = Object.fromEntries(
    Object.entries(base.tabsByWorktree ?? {}).map(([worktreeId, list]) => [
      worktreeId,
      list.map((tab) =>
        longTitle && tab.id === 'po' ? { ...tab, title: LONG_TITLE, customTitle: LONG_TITLE } : tab
      )
    ])
  )
  return {
    ...base,
    tabsByWorktree,
    agentStatusByPaneKey: statuses,
    ptyIdsByTabId: ptys,
    sleepingAgentSessionsByPaneKey: records
  }
}

const SUSPENDED_TABS = ['po', 'livre', 'pl1', 'dex']

/** Hover buttons (Suspender and X) on a Livre chat, a PO, a planner and an executor, all live. */
export const botoes = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates({ po: 'done', livre: 'done', pl1: 'done', ex1: 'done' }),
  setup,
  interact: async (frame) => {
    await tidy(frame)
    showHoverButtons(frame)
    await wait(200)
  },
  render: board
})

/** A Livre chat, a PO, a planner and an executor suspended; the PO has the long title, its model and meter. */
export const suspensos = defineFixture({
  width: 1280,
  store: suspendedStore(SUSPENDED_TABS, true),
  setup,
  interact: async (frame) => {
    await tidy(frame)
    showHoverButtons(frame)
    await wait(200)
  },
  render: board
})

/** The X of a live (done) PO: the three choices. */
export const dialogoEscolha = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates({ po: 'done', livre: 'done', pl1: 'done', ex1: 'done' }),
  setup,
  interact: async (frame) => {
    await tidy(frame)
    const card = frame.querySelector('[data-chat-key="po"]')
    card?.querySelector<HTMLElement>('.cc-xbtn:not(.cc-sbtn)')?.click()
    await wait(500)
  },
  render: board
})

/** The planner is working: X, then "Fechar definitivamente" asks again and says what is lost. */
export const dialogoTrabalhandoFechar = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates({ po: 'done', pl1: 'working', ex1: 'done' }),
  setup,
  interact: async (frame) => {
    await tidy(frame)
    frame
      .querySelector('[data-chat-key="pl1"]')
      ?.querySelector<HTMLElement>('.cc-xbtn:not(.cc-sbtn)')
      ?.click()
    await wait(400)
    const forGood = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="dialog-footer"] button')
    ].find((button) => button.textContent === 'Fechar definitivamente')
    forGood?.click()
    await wait(500)
  },
  render: board
})

/** Same working planner, Suspender chosen: the confirmation says the turn stops and the conversation is kept. */
export const dialogoTrabalhandoSuspender = defineFixture({
  width: 1280,
  store: scenarioStoreWithStates({ po: 'done', pl1: 'working', ex1: 'done' }),
  setup,
  interact: async (frame) => {
    await tidy(frame)
    frame.querySelector('[data-chat-key="pl1"]')?.querySelector<HTMLElement>('.cc-sbtn')?.click()
    await wait(400)
    const suspend = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="dialog-footer"] button')
    ].find((button) => button.textContent === 'Suspender')
    suspend?.click()
    await wait(500)
  },
  render: board
})

/** The long chat name in the choice dialog: the worst line the dialog can get. */
export const dialogoNomeLongo = defineFixture({
  width: 900,
  render: () => (
    <CanvasChatCloseDialog
      stage="choose"
      name={LONG_TITLE}
      working={false}
      hasAgents
      canSuspend
      onStage={() => {}}
      onSuspend={() => {}}
      onCloseForGood={() => {}}
    />
  )
})

/** Clicking a suspended card asks Orca to wake that one chat: the banner shows the wake request the click sent. */
export const acordar = defineFixture({
  width: 1280,
  store: suspendedStore(SUSPENDED_TABS),
  setup,
  interact: async (frame) => {
    await tidy(frame)
    window.addEventListener(
      WAKE_HIBERNATED_AGENTS_WORKTREE_EVENT,
      (event) => {
        const detail = (event as CustomEvent<{ worktreeId: string; tabIds?: string[] }>).detail
        const banner = document.createElement('div')
        banner.setAttribute(
          'style',
          'position:absolute;top:8px;left:8px;z-index:99;padding:6px 10px;background:#0b6;color:#fff;font:12px system-ui'
        )
        banner.textContent = `acordar pedido: tabIds=${JSON.stringify(detail.tabIds)}`
        frame.appendChild(banner)
      },
      { once: true }
    )
    frame.querySelector<HTMLElement>('[data-chat-key="livre"]')?.click()
    await wait(900)
  },
  render: board
})

/** The planner was closed for good: its two executors hang from the PO (nearest open ancestor), not from the project. */
function withoutChat(tab: string): Partial<AppState> {
  const base = scenarioStoreWithStates({ po: 'done', ex1: 'done', ex2: 'done' })
  const statuses = { ...base.agentStatusByPaneKey }
  delete statuses[`${tab}:${LEAF}`]
  const ptys = { ...base.ptyIdsByTabId }
  delete ptys[tab]
  return {
    ...base,
    agentStatusByPaneKey: statuses,
    ptyIdsByTabId: ptys,
    tabsByWorktree: Object.fromEntries(
      Object.entries(base.tabsByWorktree ?? {}).map(([worktreeId, list]) => [
        worktreeId,
        list.filter((item) => item.id !== tab)
      ])
    )
  }
}

export const filhoSemAvo = defineFixture({
  width: 1280,
  store: withoutChat('pl1'),
  setup,
  interact: tidy,
  render: board
})
