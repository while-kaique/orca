// Todo texto que a hierarquia digita num chat só é digitado com o Claude aberto naquele terminal; senão fica guardado
// no registro e é entregue quando o Claude volta (o-041, parte 6: o aviso que o PowerShell tentou executar em 12/11).
import { escreverNoChat, orcaEmSegundoPlano } from './orca-lancador.mjs'
import { anotar, lerEventos } from './registro.mjs'
import { montarEstado } from './regras.mjs'
import { lerTelaDoClaude } from './regras-da-porta.mjs'

/** O terminal de agora do chat: depois de o Orca reabrir o identificador muda, a aba (o chat) não. */
export async function terminalDoChat(chatId, handleConhecido) {
  try {
    const terminais = (await orcaEmSegundoPlano(['terminal', 'list'])).result?.terminals ?? []
    const vivo = terminais.find(
      (t) => t.connected !== false && (t.tabId === chatId || t.handle === handleConhecido)
    )
    return vivo?.handle ?? null
  } catch {
    return null
  }
}

/** O Claude está aberto nesse terminal (a caixa de entrada dele aparece)? Na dúvida, não. */
export async function claudeAberto(handle) {
  if (!handle) {
    return false
  }
  const tela = await orcaEmSegundoPlano(['terminal', 'read', '--terminal', handle])
    .then((resposta) => resposta.result?.terminal?.tail ?? null)
    .catch(() => null)
  return tela ? lerTelaDoClaude(tela).aberto : false
}

const novoId = () => `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/** Digita o aviso se o Claude do chat está aberto; senão guarda. Devolve 'escrito' ou 'guardado'. */
export async function avisarChat(projeto, chatId, handleConhecido, texto) {
  const handle = await terminalDoChat(chatId, handleConhecido)
  if ((await claudeAberto(handle)) && (await escreverNoChat(handle, texto))) {
    return 'escrito'
  }
  anotar(projeto, 'aviso_guardado', { avisoId: novoId(), chatId, texto })
  return 'guardado'
}

/** Avisos guardados de um chat, na ordem em que chegaram. */
export function guardadosDoChat(estado, chatId) {
  return Object.values(estado.guardados ?? {})
    .filter((aviso) => aviso.chatId === chatId)
    .sort((a, b) => String(a.t).localeCompare(String(b.t)))
}

/**
 * Entrega os guardados dos chats pedidos que já têm o Claude aberto. Cada aviso é marcado entregue antes de ser
 * digitado (chega uma vez); se a digitação falha, volta a ficar guardado.
 */
export async function entregarGuardados(projeto, chatIds, log = () => {}) {
  const estado = montarEstado(lerEventos(projeto))
  for (const chatId of new Set(chatIds)) {
    const avisos = guardadosDoChat(estado, chatId)
    if (avisos.length === 0) {
      continue
    }
    const handle = await terminalDoChat(chatId, estado.chats[chatId]?.handle)
    if (!(await claudeAberto(handle))) {
      continue
    }
    for (const aviso of avisos) {
      anotar(projeto, 'aviso_entregue', { avisoId: aviso.id, chatId })
      if (!(await escreverNoChat(handle, aviso.texto))) {
        anotar(projeto, 'aviso_guardado', { avisoId: novoId(), chatId, texto: aviso.texto })
        break
      }
      log(`aviso guardado entregue a ${chatId}: ${aviso.texto.slice(0, 60)}`)
    }
  }
}

/** Quando o próprio chat roda um comando da hierarquia, os guardados dele saem na tela do comando. */
export function mostrarGuardadosNoComando(projeto, chatId) {
  const estado = montarEstado(lerEventos(projeto))
  const avisos = guardadosDoChat(estado, chatId)
  for (const aviso of avisos) {
    anotar(projeto, 'aviso_entregue', { avisoId: aviso.id, chatId, naSaidaDoComando: true })
    console.log(`AVISO GUARDADO para voce (chegou com o Claude fechado): ${aviso.texto}`)
  }
}
