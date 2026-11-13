// Regras da porta de reabrir o Orca e da tela do Claude (o-041). Puro: sem disco, sem rede, sem Orca.
import { GRACA_DO_LANCAMENTO_MS, LINHA_DE_SEPARACAO, NAO_TERMINADA, OCUPA_VAGA } from './regras.mjs'

/** Ordem lançada há menos disto é "recém-lançada": o Orca leva minutos para ligar o chat nesta máquina (o-035 mediu 3,5 a 5,7 min até o primeiro Enter), então a porta não libera reabrir. */
export const ORDEM_RECENTE_MS = GRACA_DO_LANCAMENTO_MS
/** A liberação de reabrir o Orca fecha sozinha depois disto, ou quando o Orca reabre. */
export const LIBERACAO_DURA_MS = 30 * 60 * 1000

/** A liberação de reabrir vale até o Orca reabrir (`orcaAbertoEm` depois dela) ou passar LIBERACAO_DURA_MS. */
export function liberacaoAberta(liberacao, agora, orcaAbertoEm) {
  const desde = Date.parse(liberacao?.desde ?? '')
  if (Number.isNaN(desde) || liberacao?.cancelada) {
    return false
  }
  return agora - desde < LIBERACAO_DURA_MS && !(orcaAbertoEm > desde)
}

/** Ordens que ainda não terminaram e foram criadas ou lançadas há menos de ORDEM_RECENTE_MS. */
export function ordensRecentes(estado, agora) {
  return Object.values(estado.ordens).filter((ordem) => {
    const quando = Date.parse(ordem.lancadoEm ?? ordem.criadaEm ?? '')
    return (
      NAO_TERMINADA.has(ordem.situacao) &&
      !Number.isNaN(quando) &&
      agora - quando < ORDEM_RECENTE_MS
    )
  })
}

/** A ordem ainda está trabalhando (ocupa vaga): o chat dela não pode ser cortado. */
export function ordemOcupaVaga(ordem) {
  return OCUPA_VAGA.has(ordem.situacao)
}

const GIRO_DO_CLAUDE = /^[·✢✳✶✻✽*]\s+\S+…/u
const SEGUNDO_PLANO = /(\d+) (?:shells?|background tasks?)\b/u

/**
 * O que a tela de um terminal diz do Claude: se ele está aberto (a caixa de entrada dele aparece), se está
 * trabalhando (a linha que gira, "· Pensando… (2m 3s"), e quantos comandos em segundo plano ele segura.
 */
export function lerTelaDoClaude(linhas) {
  const tela = (linhas ?? []).map((linha) => String(linha).trim())
  const caixa = tela.findLastIndex((linha) => linha.startsWith('❯'))
  const separadores = tela.filter((linha) => LINHA_DE_SEPARACAO.test(linha)).length
  const aberto =
    caixa !== -1 && separadores >= 2 && !/^PS [A-Z]:\\/u.test(tela.findLast(Boolean) ?? '')
  const rodape = caixa === -1 ? [] : tela.slice(caixa)
  const acima = caixa === -1 ? tela : tela.slice(0, caixa)
  const trabalhando = aberto && acima.slice(-8).some((linha) => GIRO_DO_CLAUDE.test(linha))
  const achado = rodape.map((linha) => linha.match(SEGUNDO_PLANO)).find(Boolean)
  return { aberto, trabalhando, segundoPlano: achado ? Number(achado[1]) : 0 }
}

/** A porta: pode reabrir só sem chat trabalhando e sem ordem recém-lançada. */
export function decidirPorta({ trabalhando, recentes }) {
  if (trabalhando.length === 0 && recentes.length === 0) {
    return { pode: true, resumo: 'sim' }
  }
  const partes = []
  if (trabalhando.length > 0) {
    partes.push(`${trabalhando.length} chat${trabalhando.length > 1 ? 's' : ''} trabalhando`)
  }
  if (recentes.length > 0) {
    partes.push(
      `${recentes.length} ordem${recentes.length > 1 ? 's' : ''} lancada${recentes.length > 1 ? 's' : ''} ha menos de ${ORDEM_RECENTE_MS / 60000} min`
    )
  }
  return { pode: false, resumo: `nao: ${partes.join(', ')}` }
}
