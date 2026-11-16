// Chats escondidos (reprovacao da o-043, ponto 2): depois de uma queda, o Orca do fork encerra ao reabrir todo chat que
// rodava no guarda de terminais sem aba na tela e grava a lista em `fork-chats-escondidos.json`. Aqui a hierarquia da
// a ordem como parada (o vigia avisa quem criou com o comando para retomar a conversa) e avisa o PO dos chats livres.
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { pastaDeDadosDoOrca } from './abas-do-orca.mjs'
import { avisarChat } from './avisos-guardados.mjs'
import { anotar, lerEventos } from './registro.mjs'
import { montarEstado, OCUPA_VAGA } from './regras.mjs'

export const MOTIVO_DO_ESCONDIDO =
  'o chat rodava escondido, sem aba, depois de o Orca cair; foi encerrado quando o Orca reabriu'

/** O que fazer com cada chat encerrado: parar a ordem dele, ou contar ao PO que um chat livre foi encerrado. */
export function decidirEscondidos(projetos, encerrados) {
  const paradas = []
  const livres = []
  for (const sessao of encerrados) {
    const dono = projetos.find(({ estado }) => sessao.tabId && estado.chats[sessao.tabId])
    const ordem = dono
      ? Object.values(dono.estado.ordens).find((o) => o.chatId === sessao.tabId)
      : null
    if (ordem && OCUPA_VAGA.has(ordem.situacao)) {
      paradas.push({ projeto: dono.projeto, ordemId: ordem.id, chatId: sessao.tabId })
    } else if (!dono) {
      livres.push(sessao)
    }
  }
  return { paradas, livres }
}

/** Le o relatorio do Orca uma vez (renomeia ao terminar) e aplica a decisao. */
export async function tratarEscondidos(projetos, dados = pastaDeDadosDoOrca()) {
  const arquivo = join(dados, 'fork-chats-escondidos.json')
  if (!existsSync(arquivo)) {
    return null
  }
  const encerrados = JSON.parse(readFileSync(arquivo, 'utf8')).ended ?? []
  renameSync(arquivo, `${arquivo}.${Date.now()}.tratado`)
  const comEstado = projetos.map((projeto) => ({
    projeto,
    estado: montarEstado(lerEventos(projeto))
  }))
  const { paradas, livres } = decidirEscondidos(comEstado, encerrados)
  for (const { projeto, ordemId } of paradas) {
    anotar(projeto, 'parou_sem_entregar', {
      ordemId,
      motivo: MOTIVO_DO_ESCONDIDO,
      automatico: true
    })
  }
  if (livres.length > 0) {
    const lista = livres
      .map((s) => `${s.cwd ?? '?'} (${s.foregroundProcess ?? 'processo'})`)
      .join('; ')
    const comPo = comEstado.filter(({ estado }) => estado.po)
    // O PO do projeto onde o chat rodava; se nenhum projeto contem a pasta, todos os POs (alguem conta ao Kaique).
    const dentro = (projeto) =>
      livres.some((s) =>
        String(s.cwd ?? '')
          .replaceAll('\\', '/')
          .toLowerCase()
          .startsWith(projeto.replaceAll('\\', '/').toLowerCase())
      )
    const alvos = comPo.some(({ projeto }) => dentro(projeto))
      ? comPo.filter(({ projeto }) => dentro(projeto))
      : comPo
    for (const { projeto, estado } of alvos) {
      await avisarChat(
        projeto,
        estado.po,
        estado.chats[estado.po]?.handle,
        `CHATS ESCONDIDOS ENCERRADOS: ao reabrir, o Orca encerrou ${livres.length} chat(s) fora da hierarquia que rodavam sem aba depois da queda: ${lista}. A conversa de cada um continua no historico do Claude daquela pasta (claude --resume).`
      )
    }
  }
  return { paradas, livres }
}
