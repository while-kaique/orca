// Quem esta vivo na maquina e e do Orca de teste: lista, conta, acha janela e encerra so o que cita o mundo.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { MUNDO_PADRAO, powershell, sleep, TEMP } from './raiz-e-mundo-de-teste.mjs'

function listarProcessos() {
  return powershell(
    'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }'
  )
    .split(/\r?\n/u)
    .map((linha) => linha.split('\t'))
    .filter(([pid, comando]) => pid && comando && Number(pid) !== process.pid)
    .map(([pid, comando]) => ({ pid: Number(pid), comando }))
}

const barrasNormais = (texto) => texto.replaceAll(path.win32.sep, '/').toLowerCase()

/** Processos vivos cuja linha de comando cita o mundo de teste (a ferramenta so mexe nesses). */
export function processosDoMundo(mundo = MUNDO_PADRAO, raizes = []) {
  const alvo = barrasNormais(path.resolve(mundo))
  return listarProcessos()
    .filter(({ pid, comando }) => raizes.includes(pid) || barrasNormais(comando).includes(alvo))
    .map(({ pid, comando }) => ({ pid, comando: comando.slice(0, 160) }))
}

/** Processos de teste vivos de qualquer mundo de vistoria (linha de comando que cita 'vistoria-fluxograma' ou 'orca-de-teste' em %TEMP%). */
export function contarProcessosDeTeste(extras = []) {
  const temp = barrasNormais(path.resolve(TEMP))
  return listarProcessos()
    .filter(({ pid, comando }) => {
      const texto = barrasNormais(comando)
      return (
        extras.includes(pid) ||
        texto.includes(`${temp}/vistoria-fluxograma`) ||
        texto.includes(`${temp}/orca-de-teste`)
      )
    })
    .map(({ pid, comando }) => ({
      pid,
      comando: comando.slice(0, 160),
      filhoSimulado: comando.endsWith(' filho')
    }))
}

/** Janelas visiveis de qualquer processo do mundo (deve ser nenhuma: o Orca de teste abre oculto). */
export function janelasVisiveisDoMundo(mundo = MUNDO_PADRAO, raizes = []) {
  const pids = processosDoMundo(mundo, raizes).map((p) => p.pid)
  if (pids.length === 0) {
    return []
  }
  try {
    const saida = powershell(
      `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { "$($_.Id)\`t$($_.MainWindowTitle)" }`
    )
    return saida.split(/\r?\n/u).filter(Boolean)
  } catch {
    // Um processo do teste saiu enquanto a lista era lida: sem janela visivel para contar.
    return []
  }
}

export async function encerrarMundo(mundo = MUNDO_PADRAO, raizes = []) {
  // O Orca recria o processo de terminal enquanto e morto: mata tudo de uma vez e confere de novo.
  for (let rodada = 0; rodada < 10; rodada++) {
    const vivos = processosDoMundo(mundo, raizes)
    if (vivos.length === 0) {
      return []
    }
    try {
      execFileSync('taskkill', ['/F', '/T', ...vivos.flatMap(({ pid }) => ['/PID', String(pid)])], {
        stdio: 'ignore',
        windowsHide: true
      })
    } catch {
      // Alguns ja sairam junto com o pai.
    }
    await sleep(800)
  }
  return processosDoMundo(mundo, raizes)
}
