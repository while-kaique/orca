// Confere se o chat novo começou a trabalhar e, se a ordem ficou parada na caixa de texto, envia até ele aceitar.
import { citar, esperar, orcaEmSegundoPlano } from './orca-lancador.mjs'
import { decidirInicio, ondeEstaAOrdem } from './regras.mjs'
import { trechosDoPedido } from './pedido-da-ordem.mjs'

const INTERVALO_MS = 2000
/** Máquina lenta: cada chamada ao Orca chega a levar 20 s, e o chat novo demora para ficar pronto. */
// HIERARQUIA_PRAZO_FINAL_MS só existe para simular a desistência sem esperar 4 min.
const PRAZO_FINAL_MS = Number(process.env.HIERARQUIA_PRAZO_FINAL_MS) || 4 * 60 * 1000

async function atividadeDoWorker(dispatchId) {
  const resposta = await orcaEmSegundoPlano([
    'orchestration',
    'worker-show',
    '--dispatch',
    dispatchId,
    '--full'
  ])
  return resposta.result?.projection?.stage?.activity ?? null
}

async function telaDoChat(handle) {
  const resposta = await orcaEmSegundoPlano(['terminal', 'read', '--terminal', handle])
  return resposta.result?.terminal ?? null
}

/** Um espaço mais Enter envia o texto que já está digitado na caixa, sem acrescentar nada. */
function enviarOQueEstaNaCaixa(handle) {
  return orcaEmSegundoPlano([
    'terminal',
    'send',
    '--terminal',
    handle,
    '--text',
    citar(' '),
    '--enter'
  ])
}

const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR')

/** O que falta, dito sem rodeio: é o que o criador lê quando o chat não começou. */
function motivoDoFracasso(vigia, chatId) {
  const chat = chatId ?? 'do lancamento'
  if (vigia.onde === 'na_caixa') {
    const enviou = vigia.enviadaEm
      ? ` (o comando ja enviou ${vigia.envios ?? 1}x e o chat nao comecou)`
      : ' (o comando nao conseguiu enviar)'
    return `a ordem esta digitada no chat ${chat}, falta enviar${enviou}`
  }
  const ocioso =
    vigia.atividade === 'done'
      ? " (o Orca marca 'done' tambem em chat que nunca recebeu a ordem: sem a ordem na conversa nao ha prova de que comecou)"
      : ''
  return `o Orca nao confirmou o inicio e a tela do chat ${chat} nao mostra a ordem enviada${ocioso}`
}

/** `pedido` é o texto enviado ao chat; `ligar` diz qual chat vigiar quando ele já existe. */
export function criarVigia(pedido) {
  const trechos = trechosDoPedido(pedido)
  let vigia = {
    naCaixaDesde: null,
    tentouEnviarEm: null,
    enviadaEm: null,
    comecouEm: null,
    envios: 0
  }
  const horasDosEnvios = []
  let alvo = null
  let registrado = null

  async function passo() {
    if (!alvo || vigia.comecouEm) {
      return
    }
    const [atividade, terminal] = await Promise.all([
      atividadeDoWorker(alvo.dispatchId).catch(() => null),
      telaDoChat(alvo.handle).catch(() => null)
    ])
    const onde = ondeEstaAOrdem(terminal?.tail ?? null, terminal?.draft, trechos)
    const decisao = decidirInicio(vigia, { atividade, onde }, Date.now())
    vigia = { ...decisao.vigia, atividade }
    if (decisao.acao === 'enviar') {
      vigia = { ...vigia, tentouEnviarEm: Date.now() }
      const resposta = await enviarOQueEstaNaCaixa(alvo.handle).catch(() => null)
      if (resposta?.ok) {
        vigia = { ...vigia, enviadaEm: Date.now() }
        horasDosEnvios.push(hora(vigia.enviadaEm))
      }
    }
  }

  const vigiaDoChat = {
    ligar(dispatchId, handle, chatId) {
      alvo = { dispatchId, handle, chatId }
    },
    passo,
    comecou: () => Boolean(vigia.comecouEm),
    /** Um passo enquanto o Orca ainda espera: grava assim que o chat começa e devolve true para parar. */
    async vigiar(anotar) {
      await passo()
      if (vigia.comecouEm) {
        this.registrar(anotar)
      }
      return Boolean(vigia.comecouEm)
    },
    async esperar(prazoMs) {
      const limite = Date.now() + prazoMs
      for (;;) {
        await passo()
        if (vigia.comecouEm || !alvo || Date.now() >= limite) {
          return
        }
        await esperar(INTERVALO_MS)
      }
    },
    /** Grava a verdade uma única vez: o chat começou (com o horário) ou não começou. `desistiu`: o vigia largou. */
    registrar(anotar, { desistiu = false } = {}) {
      const verdade = vigia.comecouEm ? 'iniciou' : 'nao_iniciou'
      // Um chat que não começou pode começar depois: a segunda verdade ainda se grava, a repetida não.
      if (!alvo || registrado === 'iniciou' || (registrado === verdade && !desistiu)) {
        return
      }
      registrado = verdade
      if (vigia.comecouEm) {
        anotar('chat_iniciou', {
          em: new Date(vigia.comecouEm).toISOString(),
          fonte: vigia.fonte,
          visto: { atividade: vigia.atividade ?? null, onde: vigia.onde ?? null },
          enviadaPeloComando: Boolean(vigia.enviadaEm),
          horasDosEnvios
        })
        return
      }
      anotar('chat_nao_iniciou', {
        enviada: Boolean(vigia.enviadaEm),
        tentouEnviar: Boolean(vigia.tentouEnviarEm),
        naCaixa: vigia.onde === 'na_caixa',
        envios: vigia.envios,
        horasDosEnvios,
        ...(desistiu ? { desistiu: true } : {}),
        motivo: motivoDoFracasso(vigia, alvo.chatId)
      })
    },
    /** Última conferência, depois de o Orca responder: espera, grava a verdade e devolve a frase para a tela. */
    async fechar(anotar, prazoMs = PRAZO_FINAL_MS) {
      await this.esperar(prazoMs)
      this.registrar(anotar)
      return this.resumo()
    },
    /** Por que não começou, na frase que o criador lê; só vale com o chat sem prova de início. */
    motivo: () => motivoDoFracasso(vigia, alvo?.chatId),
    resumo() {
      const envios = horasDosEnvios.length > 0 ? ` Envios às ${horasDosEnvios.join(', ')}.` : ''
      if (vigia.comecouEm) {
        return `Chat começou às ${hora(vigia.comecouEm)}${vigia.enviadaEm ? ' (a ordem estava parada na caixa; o comando enviou)' : ''}.${envios}`
      }
      return `ATENÇÃO: o chat NÃO começou: ${motivoDoFracasso(vigia, alvo?.chatId)}.${envios} O vigia do criador continua tentando sozinho; o estado mostra o que falta.`
    }
  }
  return vigiaDoChat
}
