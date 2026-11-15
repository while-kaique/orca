// Trava unica da maquina para o Orca de teste (regra B): dono, espera, recusa, dono morto e o estado dela.
import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { criarSeNaoExiste, lerJson, processoVivo } from '../../skills/hierarquia/trava.mjs'
import { contarProcessosDeTeste, encerrarMundo } from './processos-de-teste.mjs'
import { RAIZ, sleep, TEMP } from './raiz-e-mundo-de-teste.mjs'

export const ARQUIVO_DA_TRAVA = path.join(TEMP, 'orca-de-teste', 'trava.json')

/** Saida 3 = recusado porque ja ha Orca de teste vivo (do outro ou sem dono), nao porque a ferramenta quebrou. */
export class OrcaDeTesteOcupado extends Error {
  codigoDeSaida = 3
}

/** Trava de dono vivo: o node que abriu OU o Electron de teste ainda existe. */
export function travaViva(trava) {
  return Boolean(
    trava &&
    ((Number.isInteger(trava.pidNode) && processoVivo(trava.pidNode)) ||
      (Number.isInteger(trava.pidElectron) && processoVivo(trava.pidElectron)))
  )
}

const horaDe = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function mensagemDeUso(trava) {
  const pid =
    Number.isInteger(trava.pidNode) && processoVivo(trava.pidNode)
      ? trava.pidNode
      : trava.pidElectron
  return `Orca de teste em uso por ${trava.dono} (pasta ${trava.pasta}, desde ${horaDe(trava.desde)}, PID ${pid})`
}

function ramoDoGit(raiz) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: raiz,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    }).trim()
  } catch {
    return 'branch desconhecida'
  }
}

/** Titulo do chat quando quem chama o informa (ORCA_DE_TESTE_DONO); senao a pasta raiz do projeto e a branch. */
export function donoDestaRodada() {
  return process.env.ORCA_DE_TESTE_DONO?.trim() || `${RAIZ} (${ramoDoGit(RAIZ)})`
}

const soltarSeForMinha = () => {
  if (lerJson(ARQUIVO_DA_TRAVA)?.pidNode === process.pid) {
    rmSync(ARQUIVO_DA_TRAVA, { force: true })
  }
}

/** Grava a trava de novo (so o dono atual); escreve num arquivo ao lado e renomeia para ninguem ler pela metade. */
export function atualizarTrava(campos) {
  const atual = lerJson(ARQUIVO_DA_TRAVA)
  if (atual?.pidNode !== process.pid) {
    return
  }
  const temporario = `${ARQUIVO_DA_TRAVA}.${process.pid}.tmp`
  writeFileSync(temporario, JSON.stringify({ ...atual, ...campos }))
  renameSync(temporario, ARQUIVO_DA_TRAVA)
}

/** Dono morto: tira a trava dele e encerra so os processos que citam o mundo DAQUELA trava. */
async function tomarTravaMorta(morta, registro) {
  registro(
    `Trava de dono morto (${morta.dono}, PID ${morta.pidNode}, desde ${horaDe(morta.desde)}): tomada. Encerro so o que cita o mundo dela (${morta.mundo}).`
  )
  const sobras = await encerrarMundo(morta.mundo, [])
  registro(`  processos do mundo da trava morta encerrados; sobraram ${sobras.length}`)
  const conferida = lerJson(ARQUIVO_DA_TRAVA)
  if (conferida?.pidNode === morta.pidNode && conferida?.desde === morta.desde) {
    try {
      rmSync(ARQUIVO_DA_TRAVA, { force: true })
    } catch {
      // Outro pedido tomou a trava no mesmo instante: o laco confere de novo.
    }
  }
}

/**
 * Pega a trava unica da maquina. Dono vivo: espera (aviso a cada 30 s) ate `esperarMin`; com 0, recusa na hora (saida 3).
 * Devolve a funcao que solta. Recusa tambem se houver processo de teste vivo sem trava.
 */
export async function pegarTravaDoOrcaDeTeste({ dados, esperarMin, registro }) {
  mkdirSync(path.dirname(ARQUIVO_DA_TRAVA), { recursive: true })
  const avisoMs = Number(process.env.ORCA_DE_TESTE_AVISO_S ?? 30) * 1000
  const inicio = Date.now()
  let ultimoAviso = 0
  let ilegivel = 0
  for (;;) {
    if (criarSeNaoExiste(ARQUIVO_DA_TRAVA, dados)) {
      break
    }
    const atual = lerJson(ARQUIVO_DA_TRAVA)
    if (!atual) {
      // Arquivo sendo escrito agora, ou lixo: lixo por mais de 5 s e tratado como trava morta.
      if (++ilegivel > 10) {
        rmSync(ARQUIVO_DA_TRAVA, { force: true })
        ilegivel = 0
      }
      await sleep(500)
      continue
    }
    ilegivel = 0
    if (!travaViva(atual)) {
      await tomarTravaMorta(atual, registro)
      continue
    }
    const uso = mensagemDeUso(atual)
    if (esperarMin <= 0) {
      throw new OrcaDeTesteOcupado(`${uso}; recusado (nao espero, esperarMin 0).`)
    }
    if (Date.now() - inicio > esperarMin * 60_000) {
      throw new OrcaDeTesteOcupado(`${uso}; esperei ${esperarMin} min e desisti.`)
    }
    if (Date.now() - ultimoAviso >= avisoMs) {
      ultimoAviso = Date.now()
      registro(`${uso}; esperando`)
    }
    await sleep(1000)
  }
  // Nunca dois vivos: o que cita um mundo de vistoria e nao e desta trava impede abrir.
  let intrusos = []
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    intrusos = contarProcessosDeTeste()
    if (intrusos.length === 0) {
      break
    }
    await sleep(1000)
  }
  if (intrusos.length > 0) {
    soltarSeForMinha()
    throw new OrcaDeTesteOcupado(
      `Ha ${intrusos.length} processo(s) de teste vivo(s) sem trava, PIDs ${intrusos.map((p) => p.pid).join(', ')} (${intrusos[0].comando.slice(0, 100)}); nao abro outro. Confira e encerre so esses PIDs.`
    )
  }
  return soltarSeForMinha
}

/** O que ha agora: a trava, o dono, ha quanto tempo esta aberto e quantos processos de teste vivem. */
export function descreverEstadoDoOrcaDeTeste() {
  const trava = lerJson(ARQUIVO_DA_TRAVA)
  const processos = contarProcessosDeTeste(
    [trava?.pidElectron].filter((pid) => Number.isInteger(pid) && processoVivo(pid))
  )
  const linhas = []
  if (!trava) {
    linhas.push('Trava: nenhuma (nenhum Orca de teste aberto por esta ferramenta).')
  } else {
    const minutos = Math.max(0, Math.round((Date.now() - new Date(trava.desde).getTime()) / 60_000))
    const vida = (pid) =>
      Number.isInteger(pid) ? (processoVivo(pid) ? 'vivo' : 'morto') : 'sem PID'
    linhas.push(
      `Trava: ${travaViva(trava) ? 'DONO VIVO' : 'dono morto (a proxima rodada toma a trava)'}`,
      `  dono: ${trava.dono}`,
      `  pasta: ${trava.pasta}`,
      `  mundo: ${trava.mundo}`,
      `  aberto desde ${horaDe(trava.desde)} (ha ${minutos} min)${trava.simulado ? ' [SIMULADO]' : ''}`,
      `  PID do node: ${trava.pidNode} (${vida(trava.pidNode)}); PID do Electron: ${trava.pidElectron} (${vida(trava.pidElectron)}); porta CDP: ${trava.porta}`,
      `  comando: ${trava.comando}`
    )
  }
  linhas.push(
    `Processos de teste vivos: ${processos.length}${processos.length > 0 ? ` (PIDs ${processos.map((p) => p.pid).join(', ')})` : ''}`
  )
  return linhas.join('\n')
}
