// O chat voltou em aba nova: o registro o trata como o mesmo chat (usado por `montarEstado`). Puro.

/**
 * O chat voltou em aba nova (`hierarquia restaurar`): o novo e o mesmo chat. Herda papel, pai, ordem e a situacao dela;
 * os filhos do antigo passam a ter o novo como pai; se o antigo era o PO, o novo e o PO. O antigo fica inativo.
 */
export function herdarLugar(estado, ev) {
  const antigo = estado.chats[ev.chatAnterior]
  if (!antigo) {
    return
  }
  const novo = {
    ...antigo,
    id: ev.chatId,
    handle: ev.handle ?? null,
    ativo: true,
    mexidoPeloKaique: false,
    restauradoDe: antigo.id
  }
  for (const marca of ['cortadoEm', 'retomadoEm', 'corteAvisado', 'substituidoPor']) {
    delete novo[marca]
  }
  estado.chats[ev.chatId] = novo
  antigo.ativo = false
  antigo.substituidoPor = ev.chatId
  if (antigo.papel === 'po') {
    estado.po = ev.chatId
  }
  if (antigo.ordemId && estado.ordens[antigo.ordemId]) {
    estado.ordens[antigo.ordemId].chatId = ev.chatId
  }
  for (const chat of Object.values(estado.chats)) {
    if (chat.pai === antigo.id) {
      chat.pai = ev.chatId
    }
  }
  for (const ordem of Object.values(estado.ordens)) {
    if (ordem.de === antigo.id) {
      ordem.de = ev.chatId
    }
  }
  for (const pergunta of Object.values(estado.perguntas)) {
    pergunta.de = pergunta.de === antigo.id ? ev.chatId : pergunta.de
    pergunta.para = pergunta.para === antigo.id ? ev.chatId : pergunta.para
  }
  for (const aviso of Object.values(estado.guardados)) {
    aviso.chatId = aviso.chatId === antigo.id ? ev.chatId : aviso.chatId
  }
  for (const chave of Object.keys(estado.avisos)) {
    if (chave.startsWith(`${antigo.id} `)) {
      estado.avisos[`${ev.chatId}${chave.slice(antigo.id.length)}`] = estado.avisos[chave]
      delete estado.avisos[chave]
    }
  }
}
