/**
 * Fork: whether a finished turn ends by asking the user something (an OK, a choice, an action only he
 * can take). Read from the end of the turn's last reply, the same text the card already shows.
 * Measured against real chats in `.hierarquia/provas/o-044/sinal-precisa-de-voce.md`.
 */
import type {
  AgentStatusEntry,
  AgentStatusOrchestrationContext
} from '../../../../shared/agent-status/contracts/agent-status-types'
import { mergeAgentStatusOrchestration } from '../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import { isAgentStatusHeldOpenByChildWork } from '../../../../shared/agent-status/lifecycle/agent-lead-status-fold'

const TAIL_LINES = 3

// "Próxima ação: nenhuma sua", "Próximo (do PO): ..." never ask the user.
const NOTHING_FOR_USER =
  /\b(nenhuma|nada)\s+(da\s+)?(sua|seu|de voc[eê]|pra voc[eê]|para voc[eê])\b|\(do po\)/iu
const ASKS_FOR_OK =
  /\b(falta (o )?seu ["“]?ok|preciso do seu ["“]?ok|esperando (o )?seu ["“]?ok|esperando (a )?sua resposta|aguardo (o |a )?(seu|sua) )/iu
// Asking him to type a given word ("me diga 'abri'") waits on him even inside a longer sentence.
const QUOTED_REPLY = /\b(diga|escreva|responda|digite)\s*:?\s*["“']/iu
// A greeting to an empty chat is idle, not a question waiting on him.
const GREETING = /\b(em que|como) (posso|eu posso) (te |lhe )?ajudar\b/iu
const NEXT_STEP = /\bpr[oó]xim[oa]\s*(a[cç][aã]o|passo)?[^:]{0,24}:\s*(?<rest>.*)$/iu
const USER_VERB =
  /\b(responda|me diga|diga|confirme|aprove|escolha|decida|libere|pare|digite|autorize|me passe|me mande|me avise|me traga)\b/iu
// "Próximo: quando X acontecer, me diga" waits on something else first.
const CONDITIONAL = /^\W*(quando|assim que|se)\b/iu

/** Strips code spans and links so `?` inside a URL, a link title or a command never reads as a question. */
function prose(line: string): string {
  return line
    .replace(/`[^`]*`/gu, '')
    .replace(/\[[^\]]*\]\([^)]*\)/gu, '')
    .replace(/https?:\/\/\S+/gu, '')
}

function lineAsksUser(line: string): boolean {
  if (NOTHING_FOR_USER.test(line)) {
    return false
  }
  if (ASKS_FOR_OK.test(line) || QUOTED_REPLY.test(line) || line.includes('?')) {
    return true
  }
  const rest = NEXT_STEP.exec(line)?.groups?.rest ?? ''
  return !CONDITIONAL.test(rest) && USER_VERB.test(rest)
}

type TurnEndEvidence = Pick<
  AgentStatusEntry,
  | 'state'
  | 'interrupted'
  | 'sessionBoundary'
  | 'mainAgent'
  | 'orchestration'
  | 'lastAssistantMessage'
  | 'lastAssistantMessageIsToolOutput'
  | 'lastCompletedAssistantMessage'
>

/**
 * A top-level chat (PO or free) whose own turn ended asking the user, even while a background command or
 * subagent still holds the row open. Orchestration workers ask their creator, never the user, so never match.
 */
export function turnEndedAskingUser(
  entry: TurnEndEvidence,
  runtimeOrchestration: AgentStatusOrchestrationContext | undefined
): boolean {
  if (mergeAgentStatusOrchestration(entry, runtimeOrchestration)) {
    return false
  }
  const ended =
    (entry.state === 'done' && !entry.interrupted && !entry.sessionBoundary) ||
    isAgentStatusHeldOpenByChildWork(entry)
  if (!ended) {
    return false
  }
  const reply = entry.lastAssistantMessageIsToolOutput ? undefined : entry.lastAssistantMessage
  return replyAsksUser(reply || entry.lastCompletedAssistantMessage)
}

export function replyAsksUser(reply: string | null | undefined): boolean {
  if (!reply) {
    return false
  }
  const tail = reply
    .split(/\r?\n/u)
    .map((line) => prose(line).trim())
    .filter((line) => line.length > 0)
    .slice(-TAIL_LINES)
  return !tail.some((line) => GREETING.test(line)) && tail.some(lineAsksUser)
}
