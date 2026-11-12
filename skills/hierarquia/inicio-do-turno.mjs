// Confere se o chat novo começou a trabalhar e, se a ordem ficou parada na caixa de texto, envia uma vez.
import { citar, esperar, orcaEmSegundoPlano } from './orca-lancador.mjs'
import { decidirInicio, ondeEstaOTexto } from './regras.mjs'

const INTERVALO_MS = 2000
const PRAZO_FINAL_MS = 20000

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
  return resposta.result?.terminal?.tail ?? null
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

function motivoDoFracasso(vigia) {
  if (vigia.onde === 'na_caixa') {
    return vigia.enviadaEm
      ? 'a ordem estava parada na caixa de texto; o comando enviou e o chat continuou sem comecar'
      : 'a ordem esta parada na caixa de texto e o comando nao conseguiu enviar'
  }
  return 'o Orca nao confirmou o inicio e a tela do chat nao mostra a ordem enviada'
}

/** `trecho` é o começo do texto enviado ao chat; `ligar` diz qual chat vigiar quando ele já existe. */
export function criarVigia(trecho) {
  let vigia = { naCaixaDesde: null, tentouEnviarEm: null, enviadaEm: null, comecouEm: null }
  let alvo = null
  let registrado = false

  async function passo() {
    if (!alvo || vigia.comecouEm) {
      return
    }
    const [atividade, tela] = await Promise.all([
      atividadeDoWorker(alvo.dispatchId).catch(() => null),
      telaDoChat(alvo.handle).catch(() => null)
    ])
    const onde = tela ? ondeEstaOTexto(tela, trecho) : 'desconhecido'
    const decisao = decidirInicio(vigia, { atividade, onde }, Date.now())
    vigia = decisao.vigia
    if (decisao.acao === 'enviar') {
      vigia = { ...vigia, tentouEnviarEm: Date.now() }
      const resposta = await enviarOQueEstaNaCaixa(alvo.handle).catch(() => null)
      if (resposta?.ok) {
        vigia = { ...vigia, enviadaEm: Date.now() }
      }
    }
  }

  return {
    ligar(dispatchId, handle) {
      alvo = { dispatchId, handle }
    },
    passo,
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
    /** Grava a verdade uma única vez: o chat começou (com o horário) ou não começou. */
    registrar(anotar) {
      if (!alvo || registrado) {
        return
      }
      registrado = true
      if (vigia.comecouEm) {
        anotar('chat_iniciou', {
          em: new Date(vigia.comecouEm).toISOString(),
          fonte: vigia.fonte,
          enviadaPeloComando: Boolean(vigia.enviadaEm)
        })
        return
      }
      anotar('chat_nao_iniciou', {
        enviada: Boolean(vigia.enviadaEm),
        tentouEnviar: Boolean(vigia.tentouEnviarEm),
        naCaixa: vigia.onde === 'na_caixa',
        motivo: motivoDoFracasso(vigia)
      })
    },
    /** Última conferência, depois de o Orca responder: espera um pouco, grava a verdade e devolve a frase para a tela. */
    async fechar(anotar) {
      await this.esperar(PRAZO_FINAL_MS)
      this.registrar(anotar)
      return this.resumo()
    },
    resumo() {
      if (vigia.comecouEm) {
        const hora = new Date(vigia.comecouEm).toLocaleTimeString('pt-BR')
        return `Chat começou às ${hora}${vigia.enviadaEm ? ' (a ordem estava parada na caixa; o comando enviou)' : ''}.`
      }
      return `ATENÇÃO: o chat NÃO começou: ${motivoDoFracasso(vigia)}. Leia a tela dele antes de relançar.`
    }
  }
}
