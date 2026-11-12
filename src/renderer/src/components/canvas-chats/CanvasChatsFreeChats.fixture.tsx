import { defineFixture } from '../../component-fixtures/component-fixture'
import CanvasChatsPage from './CanvasChatsPage'
import type { Chat } from './canvas-chats-fixture-chats'
import { chat, freeScenario, type FreeScenarioProject } from './canvas-chats-fixture-free-chats'
import { scenarioPicture } from './canvas-chats-fixture-scenario'

/** Fork: where free chats sit against the hierarchy: above their project, hierarchy below. */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const board = (): React.JSX.Element => (
  <div style={{ display: 'flex', height: 860 }}>
    <CanvasChatsPage />
  </div>
)

function fixtureOf(
  projects: readonly FreeScenarioProject[],
  width = 1280,
  afterTidy?: (frame: HTMLElement) => void
): ReturnType<typeof defineFixture> {
  const scenario = freeScenario(projects)
  return defineFixture({
    width,
    store: scenario.store,
    setup: () => {
      window.api.repos.readCanvasHierarchy = () => Promise.resolve(scenario.hierarchy)
      window.api.repos.readCanvasContextTokens = () => Promise.resolve(scenario.tokens)
      window.api.repos.readCanvasChatModels = () => Promise.resolve(scenario.models)
      window.api.repos.captureCanvasPagePreview = (url) =>
        Promise.resolve({ kind: 'ok', dataUrl: scenarioPicture(url) })
      window.api.repos.readCanvasImage = ({ path }) =>
        Promise.resolve({ kind: 'ok', dataUrl: scenarioPicture(path) })
    },
    interact: async (frame) => {
      await wait(400)
      frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
      await wait(700)
      afterTidy?.(frame)
      await wait(200)
    },
    render: board
  })
}

const hierarchy = (prefix: string): Chat[] => [
  chat(`${prefix}po`, { title: 'Mestre da Loja', role: 'po', model: 'claude-fable-5-2' }),
  chat(`${prefix}pl`, {
    title: 'Tela de status',
    role: 'planejador',
    parent: `${prefix}po`,
    model: 'claude-opus-5-5',
    order: 'Critérios da tela de status'
  }),
  chat(`${prefix}e1`, {
    title: 'Montador',
    role: 'executor',
    parent: `${prefix}pl`,
    order: 'Montar a tela'
  }),
  chat(`${prefix}e2`, {
    title: 'Validador',
    role: 'executor',
    parent: `${prefix}pl`,
    order: 'Validar a tela'
  })
]

/** One project: PO, planner and two executors below; two free chats above, one with open agents. */
export const livresMisturados = fixtureOf([
  {
    repo: 'loja',
    name: 'Loja Online',
    color: '#8b5cf6',
    chats: [
      ...hierarchy('l-'),
      chat('l-livre1', {
        title: 'Ajustar o botão',
        agents: ['pesquisa de referências', 'leitor do código'],
        state: 'working'
      }),
      chat('l-livre2', { title: 'Como está o sistema?' })
    ]
  }
])

/** A project with no PO: three free chats, all above, nothing below. */
export const semPo = fixtureOf([
  {
    repo: 'painel',
    name: 'Painel Interno',
    color: '#0ea5e9',
    chats: [
      chat('s-a', { title: 'Pesquisar preço do frete' }),
      chat('s-b', { title: 'Ajustar a cor do botão', state: 'working' }),
      chat('s-c', { title: 'Como está o sistema?' })
    ]
  }
])

/** Two projects in different rows (narrow board); the lower one has free chats. */
export const doisProjetos = fixtureOf(
  [
    {
      repo: 'loja',
      name: 'Loja Online',
      color: '#8b5cf6',
      chats: [...hierarchy('t-'), chat('t-livre', { title: 'Ajustar o botão' })]
    },
    {
      repo: 'painel',
      name: 'Painel Interno',
      color: '#0ea5e9',
      chats: [
        chat('b-po', { title: 'Mestre do Painel', role: 'po', model: 'claude-fable-5-2' }),
        chat('b-l1', { title: 'Pesquisar preço do frete', agents: ['leitor do código'] }),
        chat('b-l2', { title: 'Como está o sistema?' })
      ]
    }
  ],
  760
)

const FORCED_STATE = 'aguardando equipe'

/** Counts text that leaves its card, and writes the result on the board so the shot carries it. */
function reportOverflow(frame: HTMLElement): void {
  const outside: string[] = []
  const cards = frame.querySelectorAll<HTMLElement>('.cc-chat')
  cards.forEach((card) => {
    const box = card.getBoundingClientRect()
    card.querySelectorAll<HTMLElement>('.cc-chat-head *, .cc-crest-body *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5)) {
        outside.push(`${card.dataset.chatKey}: ${el.className || el.tagName}`)
      }
    })
  })
  const note = document.createElement('div')
  note.setAttribute(
    'style',
    'position:fixed;left:12px;bottom:12px;z-index:99;padding:6px 10px;border-radius:6px;background:#111;color:#ececf3;font:12px monospace'
  )
  note.textContent = `medido: ${cards.length} cards, ${outside.length} textos fora da borda${outside.length ? ` -> ${outside.join('; ')}` : ''}`
  frame.appendChild(note)
}

/** Worst case per role: 999k of context, the longest model label, the longest state. */
export const piorCaso = fixtureOf(
  [
    {
      repo: 'loja',
      name: 'Loja Online',
      color: '#8b5cf6',
      chats: [
        chat('w-po', {
          title: 'Análise hierarquia',
          role: 'po',
          model: 'claude-sonnet-5-5',
          tokens: 999_000
        }),
        chat('w-pl', {
          title: 'Tela de status',
          role: 'planejador',
          parent: 'w-po',
          model: 'claude-sonnet-5-5',
          tokens: 999_000,
          order: 'Critérios da tela de status'
        }),
        chat('w-ex', {
          title: 'Montador',
          role: 'executor',
          parent: 'w-pl',
          model: 'claude-sonnet-5-5',
          tokens: 999_000,
          state: 'working',
          order: 'Montar a tela'
        }),
        chat('w-livre', {
          title: 'Ajustar o botão',
          model: 'claude-sonnet-5-5',
          tokens: 999_000
        })
      ]
    }
  ],
  1280,
  (frame) => {
    // A free chat has no team to wait on, so the longest state is written on it to test the width.
    frame.querySelectorAll<HTMLElement>('[data-chat-key="w-livre"] .cc-status').forEach((el) => {
      el.textContent = FORCED_STATE
    })
    reportOverflow(frame)
  }
)
