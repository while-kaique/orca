import { capSessionTitle } from './session-title-cap'

export type PcDeskSessionTitleRequest = {
  cwd: string
  projectName: string
  currentTitle: string
  /** True while the tab still shows the project name, so the model must propose a real name. */
  currentIsPlaceholder: boolean
  /** User messages from the tab's oldest chat, oldest first. */
  recentPrompts: string[]
  /** The assistant's latest reply; gives context when the prompts are vague ("e aí"). */
  lastAssistantMessage?: string
}

export type PcDeskSessionTitleResult =
  | { kind: 'keep' }
  | { kind: 'rename'; title: string }
  | { kind: 'error'; error: string }

const PROMPT_PREVIEW_CHARS = 400

// Why a module flag: the shared title resolvers run in many renderer call sites that
// don't know about the fork's PC-desk mode; the renderer flips this once on startup.
let smartTitlesPreferred = false

export function setPcDeskSmartTitlesPreferred(next: boolean): void {
  smartTitlesPreferred = next
}

/** The namer's title (kept in generatedTitle) when PC-desk mode puts it above provider titles. */
export function preferredPcDeskSessionTitle(generatedTitle: string | null | undefined): string {
  return smartTitlesPreferred ? (generatedTitle?.trim() ?? '') : ''
}
const KEEP_TOKEN = 'KEEP'

export function buildPcDeskSessionTitlePrompt(request: PcDeskSessionTitleRequest): string {
  const messages = request.recentPrompts
    .map((prompt) => `- ${prompt.replace(/\s+/gu, ' ').trim().slice(0, PROMPT_PREVIEW_CHARS)}`)
    .join('\n')
  const decision = request.currentIsPlaceholder
    ? 'O nome atual é só o nome do projeto: proponha um nome para o que o usuário está fazendo.'
    : `Se o nome atual ainda descreve o que o usuário está fazendo agora, responda exatamente ${KEEP_TOKEN}. ` +
      'Só troque se ele mudou de fase ou de assunto; detalhes novos da mesma tarefa não contam.'
  return [
    'Você dá nome a abas de sessões de trabalho num editor de código.',
    `Projeto: "${request.projectName}". Nome atual da aba: "${request.currentTitle}".`,
    'Últimas mensagens do usuário (a mais recente por último):',
    messages,
    ...(request.lastAssistantMessage
      ? [
          `Última resposta do assistente: ${request.lastAssistantMessage.replace(/\s+/gu, ' ').trim().slice(0, PROMPT_PREVIEW_CHARS)}`
        ]
      : []),
    '',
    decision,
    'Nome novo: no máximo 3 palavras e 23 caracteres, no idioma das mensagens, sem artigos nem preposições,',
    'sem aspas e sem ponto final. Exemplo: Botão adicionar projeto',
    `Responda só com ${KEEP_TOKEN} ou com o nome, nada mais.`
  ].join('\n')
}

export function parsePcDeskSessionTitleOutput(
  rawOutput: string,
  currentTitle: string
): PcDeskSessionTitleResult {
  const firstLine =
    rawOutput
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  const cleaned = firstLine.replace(/^["'“”`*]+|["'“”`*.]+$/gu, '').trim()
  if (!cleaned) {
    return { kind: 'error', error: 'empty session title' }
  }
  if (cleaned.toUpperCase() === KEEP_TOKEN) {
    return { kind: 'keep' }
  }
  const title = capSessionTitle(cleaned)
  return title && title !== currentTitle ? { kind: 'rename', title } : { kind: 'keep' }
}
