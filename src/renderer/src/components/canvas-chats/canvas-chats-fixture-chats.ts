import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'

/** Fork: the made-up chats the flowchart fixtures draw: one project with the full hierarchy, one with a PO and a direct executor. */
export type Chat = {
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
  /** Chats of the second project (PO and executor only). */
  direct?: true
}

export const CHATS: Chat[] = [
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
    tab: 'livre',
    model: 'claude-sonnet-5-5',
    title: 'Conversa solta',
    role: null,
    parent: null,
    state: 'done',
    prompt: 'me explica essa mensagem de erro',
    reply: 'É um erro de rede; tente de novo em alguns minutos.',
    tokens: 42_000
  },
  {
    tab: 'dpo',
    model: 'claude-fable-5-2',
    title: 'Mestre do Painel',
    role: 'po',
    parent: null,
    state: 'done',
    prompt: 'conserte o filtro do painel',
    reply: 'Um executor cuida do filtro.',
    tokens: 64_000,
    direct: true
  },
  {
    tab: 'dex',
    model: 'claude-sonnet-5-5',
    title: 'Consertador',
    role: 'executor',
    parent: 'dpo',
    state: 'done',
    prompt: 'conserte o filtro',
    reply: 'Filtro conserta nos três tamanhos.',
    tokens: 52_000,
    order: 'Consertar o filtro do painel',
    direct: true
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
    order: 'Critérios e Juízes do PSD',
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
  }
]
