// OK ou devolução do Kaique a uma ordem que espera por ele. Usado pelo comando `hierarquia`.
import { avisarPo } from './orca-lancador.mjs'
import { acharProjeto, anotar, lerEventos, sair } from './registro.mjs'
import { montarEstado } from './regras.mjs'

/** Só o Kaique decide: chat da hierarquia não dá OK no próprio trabalho. */
export function decisaoDoKaique(op, tipo) {
  const projeto = acharProjeto(op.projeto) ?? sair('Não achei a pasta .hierarquia deste projeto.')
  const estado = montarEstado(lerEventos(projeto))
  const chat = process.env.ORCA_TAB_ID
  if (chat && estado.chats[chat]) {
    sair('Só o Kaique dá OK ou devolve. Um chat da hierarquia não decide o próprio trabalho.')
  }
  if (estado.ordens[op.ordem]?.situacao !== 'esperando_kaique') {
    sair(`A ordem ${op.ordem} não está esperando o Kaique.`)
  }
  if (tipo !== 'ok' && String(op.motivo ?? '').trim() === '') {
    sair('Devolver exige o motivo: --motivo "..."')
  }
  anotar(projeto, tipo, { ordemId: op.ordem, ...(op.motivo ? { motivo: op.motivo } : {}) })
  avisarPo(
    estado.chats[estado.po]?.handle,
    tipo === 'ok'
      ? `O Kaique deu OK na ordem ${op.ordem}. Rode hierarquia estado e siga: agora pode juntar ou publicar essa entrega.`
      : `O Kaique DEVOLVEU a ordem ${op.ordem}. Motivo: ${op.motivo}. Rode hierarquia estado e decida o proximo passo.`
  )
  console.log(
    tipo === 'ok'
      ? `OK do Kaique registrado para ${op.ordem}.`
      : `Ordem ${op.ordem} devolvida ao PO.`
  )
}
