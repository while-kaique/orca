// Segundos de processador a cada 5 s dos processos de um Orca (tela, video, principal), lidos do Windows.
// Uso: node tools/vistoria-fluxograma/medir-processador.mjs --pid <PID do Electron principal> [--janelas 6] [--segundos 5]
// Cada janela soma o tempo de processador gasto por tipo de processo naquele intervalo.
import { execFileSync } from 'node:child_process'

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome)
  return i === -1 ? padrao : process.argv[i + 1]
}

const powershell = (comando) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  })

/** Arvore do PID raiz: pid, tipo (renderer, gpu-process, utility, principal) e segundos de processador ate agora. */
export function amostrarArvore(raiz) {
  const linhas = powershell(
    `$t = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine,KernelModeTime,UserModeTime,WorkingSetSize; $t | ForEach-Object { "$($_.ProcessId)\`t$($_.ParentProcessId)\`t$($_.KernelModeTime + $_.UserModeTime)\`t$($_.WorkingSetSize)\`t$($_.CommandLine)" }`
  )
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((linha) => {
      const [pid, pai, cem, memoria, ...comando] = linha.split('\t')
      return {
        pid: Number(pid),
        pai: Number(pai),
        segundos: Number(cem) / 1e7,
        memoria: Number(memoria),
        comando: comando.join('\t')
      }
    })
  const filhos = new Map()
  for (const p of linhas) {
    filhos.set(p.pai, [...(filhos.get(p.pai) ?? []), p])
  }
  const arvore = []
  // Windows reuses PIDs: an orphan can name a descendant as its parent, so each PID is visited once.
  const visitados = new Set()
  const visitar = (pid) => {
    if (visitados.has(pid)) {
      return
    }
    visitados.add(pid)
    const proprio = linhas.find((p) => p.pid === pid)
    if (proprio) {
      arvore.push(proprio)
    }
    for (const filho of filhos.get(pid) ?? []) {
      visitar(filho.pid)
    }
  }
  visitar(raiz)
  return arvore.map((p) => ({
    ...p,
    tipo:
      /--type=([w-]+)/u.exec(p.comando)?.[1] ??
      (p.pid === raiz ? 'principal' : 'chats e outros filhos')
  }))
}

/** Gasto por tipo em cada janela de `segundos`: [{ janela, porTipo: { renderer: s, 'gpu-process': s, ... } }]. */
export async function medirGasto(raiz, { janelas = 6, segundos = 5 } = {}) {
  const resultado = []
  let antes = new Map(amostrarArvore(raiz).map((p) => [p.pid, p]))
  for (let janela = 1; janela <= janelas; janela++) {
    await new Promise((resolve) => setTimeout(resolve, segundos * 1000))
    const agora = amostrarArvore(raiz)
    const porTipo = {}
    for (const p of agora) {
      const gasto = p.segundos - (antes.get(p.pid)?.segundos ?? p.segundos)
      porTipo[p.tipo] = Math.round(((porTipo[p.tipo] ?? 0) + gasto) * 100) / 100
    }
    resultado.push({ janela, porTipo })
    antes = new Map(agora.map((p) => [p.pid, p]))
  }
  return resultado
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) {
  const pid = Number(arg('--pid'))
  if (!pid) {
    console.error('Uso: node medir-processador.mjs --pid <PID do Electron principal>')
    process.exit(2)
  }
  const janelas = await medirGasto(pid, {
    janelas: Number(arg('--janelas', '6')),
    segundos: Number(arg('--segundos', '5'))
  })
  console.log(JSON.stringify(janelas, null, 1))
}
