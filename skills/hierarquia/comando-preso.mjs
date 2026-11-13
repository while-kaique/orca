// Comando preso (complemento da o-043): em 13/11 o planejador da o-042 ficou 41 min num unico comando de shell que
// nunca terminou (python com heredoc) e o estado dizia "trabalhando". O sistema percebe e avisa quem criou uma vez,
// sem dar a ordem como parada e sem mexer no chat.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs'

/**
 * 15 min: o Bash do Claude Code corta sozinho um comando em primeiro plano em no maximo 10 min. Passou disso com
 * 5 min de folga, o proprio limite falhou e o comando esta preso. Comando em segundo plano nao conta (ele devolve na
 * hora) e espera longa legitima (a `vez`) tambem roda dentro dos 10 min.
 */
export const COMANDO_PRESO_MS = 15 * 60 * 1000
const FERRAMENTAS_DE_SHELL = new Set(['Bash', 'PowerShell'])
const TRECHO_FINAL_BYTES = 512 * 1024

/**
 * O ultimo comando de shell sem resultado nas linhas do transcript do Claude, e quando houve a ultima novidade
 * (qualquer linha com hora depois dele). null quando nao ha comando aberto.
 */
export function comandoAberto(linhas) {
  let aberto = null
  for (const linha of linhas) {
    let ev
    try {
      ev = JSON.parse(linha)
    } catch {
      continue
    }
    for (const parte of Array.isArray(ev.message?.content) ? ev.message.content : []) {
      if (parte?.type === 'tool_result' && aberto && parte.tool_use_id === aberto.id) {
        aberto = null
      } else if (
        ev.type === 'assistant' &&
        parte?.type === 'tool_use' &&
        FERRAMENTAS_DE_SHELL.has(parte.name)
      ) {
        aberto = {
          id: parte.id,
          comando: String(parte.input?.command ?? ''),
          desde: ev.timestamp,
          novidadeEm: ev.timestamp
        }
        continue
      }
    }
    if (aberto && ev.timestamp && ev.timestamp > aberto.novidadeEm) {
      aberto.novidadeEm = ev.timestamp
    }
  }
  return aberto
}

/** Preso: um comando aberto ha COMANDO_PRESO_MS e nada novo no transcript desde entao. */
export function comandoPreso(aberto, agora = Date.now()) {
  if (!aberto?.desde) {
    return null
  }
  const desde = Date.parse(aberto.desde)
  if (
    agora - desde < COMANDO_PRESO_MS ||
    agora - Date.parse(aberto.novidadeEm) < COMANDO_PRESO_MS
  ) {
    return null
  }
  return {
    ferramentaId: aberto.id,
    desde: aberto.desde,
    minutos: Math.floor((agora - desde) / 60000),
    comando: aberto.comando.split('\n')[0].slice(0, 80)
  }
}

/** Le so o fim do transcript (ele cresce a dezenas de MB). Sem arquivo, null. */
export function comandoAbertoNoTranscript(arquivo) {
  if (!arquivo) {
    return null
  }
  let fd
  try {
    fd = openSync(arquivo, 'r')
    const tamanho = fstatSync(fd).size
    const inicio = Math.max(0, tamanho - TRECHO_FINAL_BYTES)
    const buffer = Buffer.alloc(tamanho - inicio)
    readSync(fd, buffer, 0, buffer.length, inicio)
    const linhas = buffer.toString('utf8').split('\n')
    return comandoAberto(inicio > 0 ? linhas.slice(1) : linhas)
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
}

/** Ordens trabalhando com chat ligado e comando preso: Map(ordemId -> preso). `agentes` vem de estadosDosAgentes. */
export function ordensComComandoPreso(estado, vidas, agentes, agora = Date.now()) {
  const presos = new Map()
  for (const ordem of Object.values(estado.ordens)) {
    if (ordem.situacao !== 'trabalhando' || !ordem.chatId || vidas.get(ordem.chatId) !== 'ligado') {
      continue
    }
    const preso = comandoPreso(
      comandoAbertoNoTranscript(agentes.get(ordem.chatId)?.transcript),
      agora
    )
    if (preso) {
      presos.set(ordem.id, preso)
    }
  }
  return presos
}

export const TEXTO_DO_COMANDO_PRESO = (ordemId, preso) =>
  `ORDEM ${ordemId}: o chat esta com UM comando de shell rodando ha ${preso.minutos} min sem nada novo (${preso.comando}). O limite do proprio Claude e 10 min, entao ele pode estar preso. A ordem segue como trabalhando e ninguem mexeu no chat: confira o card e, se for o caso, interrompa o comando.`
