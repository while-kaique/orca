// Chat perdido (reprovacao da o-043, ponto 1): quando o chat de uma ordem trabalhando some (a aba nao voltou depois de
// o Orca reabrir, ou rodava escondido e foi encerrado), quem criou recebe uma vez o aviso com o chat que se perdeu e o
// comando para retomar a conversa dele. A conversa e achada pelo dispatchId, que esta no texto da ordem.
import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { criadorSumiu } from './regras.mjs'

/** Paradas mais antigas que isto nao geram aviso: o aviso e para o que acabou de acontecer, nao para o historico. */
export const AVISO_DE_CONVERSA_PERDIDA_ATE_MS = 6 * 60 * 60 * 1000
const CABECA_BYTES = 4 * 1024 * 1024

/** A pasta em que o Claude Code guarda as conversas de uma pasta de trabalho (todo caractere fora de [A-Za-z0-9] vira -). */
export function pastaDasConversas(pasta, raiz = join(homedir(), '.claude', 'projects')) {
  return join(raiz, String(pasta).replace(/[^A-Za-z0-9]/gu, '-'))
}

/** A conversa (sessao do Claude) que recebeu esta ordem: o arquivo cujo comeco cita o dispatchId. null se nao achou. */
export function acharConversa({ pasta, dispatchId, desdeMs = 0, raiz }) {
  if (!pasta || !dispatchId) {
    return null
  }
  const dir = pastaDasConversas(pasta, raiz)
  let nomes = []
  try {
    nomes = readdirSync(dir).filter((nome) => nome.endsWith('.jsonl'))
  } catch {
    return null
  }
  const candidatos = nomes
    .map((nome) => ({ arquivo: join(dir, nome), mtime: statSync(join(dir, nome)).mtimeMs }))
    .filter((c) => c.mtime >= desdeMs - 60_000)
    .sort((a, b) => b.mtime - a.mtime)
  for (const { arquivo } of candidatos) {
    let fd
    try {
      fd = openSync(arquivo, 'r')
      const buffer = Buffer.alloc(Math.min(CABECA_BYTES, statSync(arquivo).size))
      readSync(fd, buffer, 0, buffer.length, 0)
      if (buffer.toString('utf8').includes(dispatchId)) {
        return { sessao: basename(arquivo, '.jsonl'), arquivo }
      }
    } catch {
      // arquivo sumiu ou esta preso: segue para o proximo
    } finally {
      if (fd !== undefined) {
        closeSync(fd)
      }
    }
  }
  return null
}

/**
 * Ordens de `eu` (ou herdadas por ele, PO atual) que pararam sozinhas ha pouco porque o chat sumiu, ainda sem aviso.
 * `vidas`: Map(chatId -> ligado|dormindo|fechado). So conta chat fechado: o dormindo volta pela volta dos cortados.
 */
export function ordensComConversaPerdida(estado, eu, vidas, agora = Date.now()) {
  return Object.values(estado.ordens).filter(
    (ordem) =>
      ordem.situacao === 'parou' &&
      ordem.paradaAutomatica &&
      !ordem.conversaAvisada &&
      ordem.chatId &&
      vidas.get(ordem.chatId) === 'fechado' &&
      agora - Date.parse(ordem.paradaEm ?? 0) < AVISO_DE_CONVERSA_PERDIDA_ATE_MS &&
      (ordem.de === eu || (eu === estado.po && criadorSumiu(estado, ordem, vidas)))
  )
}

export function textoDaConversaPerdida(ordem, conversa) {
  const titulo = String(ordem.campos?.titulo ?? ordem.id).slice(0, 70)
  const comoRetomar = conversa
    ? `A conversa dele esta guardada: para retomar, abra um terminal na pasta ${ordem.pasta} e rode: claude --resume ${conversa.sessao}`
    : `Nao achei a conversa dele em ${ordem.pasta}; relance a ordem se o trabalho ainda importa`
  return `CHAT PERDIDO: o chat da ordem ${ordem.id} (${titulo}) sumiu quando o Orca fechou ou caiu, e a aba nao voltou. A ordem foi dada como parada. ${comoRetomar}.`
}
