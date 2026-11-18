import { defineFixture } from '../../component-fixtures/component-fixture'
import type { AppState } from '@/store/types'
import CanvasChatsPage from './CanvasChatsPage'
import { LEAF, STATE_HIERARCHY, stateStore } from './canvas-chats-fixture-states'

/** Fork (o-052): the hover peek of a closed card, with made-up messages of the kinds the peek has to cut or format. */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const board = (): React.JSX.Element => (
  <div style={{ display: 'flex', height: 860 }}>
    <CanvasChatsPage />
  </div>
)

function setup(): void {
  window.api.repos.readCanvasHierarchy = () => Promise.resolve(STATE_HIERARCHY)
  window.api.repos.readCanvasContextTokens = () => Promise.resolve({})
  window.api.repos.readCanvasChatModels = () => Promise.resolve({})
}

/** The "visto" chat of the states project answers with these messages. */
function chatWith(prompt: string, reply: string): Partial<AppState> {
  const store = stateStore()
  const paneKey = `visto:${LEAF}`
  const entry = store.agentStatusByPaneKey![paneKey]
  return {
    ...store,
    agentStatusByPaneKey: {
      ...store.agentStatusByPaneKey,
      [paneKey]: { ...entry, prompt, lastAssistantMessage: reply || undefined }
    }
  }
}

async function hoverVisto(frame: HTMLElement): Promise<void> {
  await wait(600)
  frame.querySelector<HTMLButtonElement>('.cc-tidy')?.click()
  await wait(900)
  frame
    .querySelector('[data-chat-key="visto"]')
    ?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
  await wait(500)
}

const fixture = (prompt: string, reply: string): ReturnType<typeof defineFixture> =>
  defineFixture({
    width: 1280,
    store: chatWith(prompt, reply),
    setup,
    interact: hoverVisto,
    render: board
  })

const PARAGRAPH =
  'O **relatório de custos** foi refeito com as tabelas novas e a aba `resumo` agora soma os três centros de custo. '

/** Worst case of text: a prompt longer than the limit and a reply far longer than the peek keeps. */
export const mensagemLonga = fixture(
  'Revisa a planilha de custos do trimestre inteiro, confere os totais de cada centro de custo com o relatório do financeiro e me diz se alguma linha ficou fora da soma final antes de eu mandar',
  `${PARAGRAPH.repeat(9)}\n\nPor fim, **nenhuma linha** ficou de fora e o total bate com o do financeiro.`
)

export const comLista = fixture(
  'Lista o que falta para fechar a entrega',
  'Faltam estes itens:\n\n- Conferir os **totais** do trimestre\n- Atualizar a aba `resumo`\n- Mandar o arquivo para o financeiro\n\nDepois disso:\n\n1. Salvar uma cópia no Drive\n2. Avisar o time\n3. Arquivar o chat'
)

export const comCodigo = fixture(
  'Como rodo o teste só desse arquivo?',
  'Rode `pnpm test src/custos.test.ts` na pasta do projeto.\n\n```bash\npnpm test src/custos.test.ts --maxWorkers=2\n```\n\nSe falhar, o erro aparece em **vermelho** logo abaixo.'
)

export const semMensagens = fixture('', '')
