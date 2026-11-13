// A volta (o-041 parte 4): chat da hierarquia cortado no meio (Orca fechado pelo X, ou o chat ficou sem terminal)
// recebe, quando o Claude dele estiver aberto, um aviso para conferir e continuar; quem criou fica sabendo. Um por vez.
import {
  avisarChat,
  claudeAberto,
  entregarGuardados,
  guardadosDoChat,
  terminalDoChat
} from './avisos-guardados.mjs'
import { anotar, lerEventos } from './registro.mjs'
import { montarEstado } from './regras.mjs'
import { ordemOcupaVaga } from './regras-da-porta.mjs'

export const TEXTO_DA_VOLTA = (ordemId) =>
  `O ORCA FOI FECHADO NO MEIO DO SEU TRABALHO${ordemId ? ` na ordem ${ordemId}` : ''}. O que estava rodando (comando, teste, comando em segundo plano) foi interrompido e nao terminou. Confira o estado do seu trabalho (git status, arquivos, provas), refaca o passo que foi cortado e continue de onde parou.`

const cortado = (chat) => Boolean(chat?.ativo && chat.cortadoEm && !chat.retomadoEm)

/** Quem o vigia de `eu` traz de volta: o próprio `eu` (um PO cortado) e os chats das ordens dele que ainda trabalham. */
export function cortadosDoVigia(estado, eu) {
  const lista = cortado(estado.chats[eu]) ? [{ chat: estado.chats[eu], ordem: null }] : []
  for (const ordem of Object.values(estado.ordens)) {
    const chat = ordem.chatId ? estado.chats[ordem.chatId] : null
    if (ordem.de === eu && cortado(chat) && ordemOcupaVaga(ordem)) {
      lista.push({ chat, ordem })
    }
  }
  return lista
}

/**
 * Um passo da volta, chamado pelo vigia: pega o primeiro chat cortado. Com o Claude dele aberto, entrega o aviso
 * (guardado ou novo; ele volta a trabalhar) e conta a quem criou. Sem o Claude, guarda o aviso e conta a quem criou,
 * uma vez, que o chat espera ser aberto. Chat livre nunca entra aqui: ele só volta dormindo.
 */
export async function retomarUmCortado(projeto, eu, log = () => {}) {
  const estado = montarEstado(lerEventos(projeto))
  const alvo = cortadosDoVigia(estado, eu)[0]
  if (!alvo) {
    return null
  }
  const { chat, ordem } = alvo
  const ordemId = ordem?.id ?? null
  const criador = ordem ? estado.chats[eu]?.handle : null
  const contar = (texto) => (ordem ? avisarChat(projeto, eu, criador, texto) : null)
  const handle = await terminalDoChat(chat.id, chat.handle)
  if (handle && (await claudeAberto(handle))) {
    if (guardadosDoChat(estado, chat.id).length > 0) {
      await entregarGuardados(projeto, [chat.id], log)
    } else if (!chat.corteAvisado) {
      await avisarChat(projeto, chat.id, handle, TEXTO_DA_VOLTA(ordemId))
    }
    anotar(projeto, 'chat_retomado', { ...(ordemId ? { ordemId } : {}), chatId: chat.id, handle })
    await contar(
      `ORDEM ${ordemId}: o chat foi cortado quando o Orca fechou e ja recebeu o aviso para continuar de onde parou.`
    )
    log(`volta ${ordemId ?? chat.id}: aviso entregue, chat retomado`)
    return 'retomado'
  }
  if (!chat.corteAvisado) {
    anotar(projeto, 'aviso_guardado', {
      avisoId: `volta-${chat.id}-${Date.now()}`,
      chatId: chat.id,
      texto: TEXTO_DA_VOLTA(ordemId)
    })
    anotar(projeto, 'corte_avisado', { ...(ordemId ? { ordemId } : {}), chatId: chat.id })
    await contar(
      `ORDEM ${ordemId}: o chat foi cortado quando o Orca fechou e voltou DORMINDO. Ao abrir o card dele, o aviso para continuar chega sozinho; ate la ele aparece na fila, nao como trabalhando.`
    )
    log(`volta ${ordemId ?? chat.id}: chat sem o Claude aberto, aviso guardado`)
  }
  return 'esperando'
}
