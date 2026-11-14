// Lista a arvore de processos de um chat a partir do PID raiz do terminal dele (claude, node, conectores MCP,
// comandos em segundo plano) com memoria de cada um, e soma. So le: nao mata nada.
// Uso: node tools/vistoria-fluxograma/medir-processos-do-chat.mjs <pid-raiz> [--json]
import { execFileSync } from 'node:child_process'

const MB = 1024 * 1024

/** Uma leitura da tabela de processos do Windows (sem linha de comando: ela pode carregar segredo). */
function lerTabela() {
  const saida = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,WorkingSetSize | ConvertTo-Json -Compress'
    ],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * MB }
  )
  const linhas = JSON.parse(saida)
  return (Array.isArray(linhas) ? linhas : [linhas]).map((linha) => ({
    pid: linha.ProcessId,
    ppid: linha.ParentProcessId,
    nome: linha.Name,
    bytes: Number(linha.WorkingSetSize ?? 0)
  }))
}

/** A raiz e todos os descendentes, em profundidade, cada um com o nivel (0 = raiz). */
export function arvoreDoProcesso(tabela, raiz) {
  const porPai = new Map()
  const porPid = new Map()
  for (const processo of tabela) {
    porPid.set(processo.pid, processo)
    porPai.set(processo.ppid, [...(porPai.get(processo.ppid) ?? []), processo])
  }
  const inicio = porPid.get(raiz)
  if (!inicio) {
    return null
  }
  const vistos = new Set([raiz])
  const linhas = []
  const descer = (processo, nivel) => {
    linhas.push({ ...processo, nivel })
    for (const filho of (porPai.get(processo.pid) ?? []).sort((a, b) => a.pid - b.pid)) {
      // O Windows reaproveita PID: um filho que ja apareceu nao entra de novo (evita laco).
      if (!vistos.has(filho.pid)) {
        vistos.add(filho.pid)
        descer(filho, nivel + 1)
      }
    }
  }
  descer(inicio, 0)
  return linhas
}

function main() {
  const [alvo, ...opcoes] = process.argv.slice(2)
  const raiz = Number(alvo)
  if (!Number.isInteger(raiz) || raiz <= 0) {
    console.error('Uso: node medir-processos-do-chat.mjs <pid-raiz> [--json]')
    process.exit(2)
  }
  const arvore = arvoreDoProcesso(lerTabela(), raiz)
  if (!arvore) {
    console.error(`Nao ha processo vivo com o PID ${raiz}.`)
    process.exit(1)
  }
  const totalBytes = arvore.reduce((soma, processo) => soma + processo.bytes, 0)
  if (opcoes.includes('--json')) {
    console.log(JSON.stringify({ raiz, processos: arvore, totalBytes }, null, 2))
    return
  }
  for (const processo of arvore) {
    const memoria = `${(processo.bytes / MB).toFixed(1)} MB`.padStart(10)
    console.log(`${'  '.repeat(processo.nivel)}${processo.pid}  ${processo.nome}  ${memoria}`)
  }
  console.log(
    `--\n${arvore.length} processo(s), ${(totalBytes / MB).toFixed(1)} MB no total (memoria em uso de cada um; paginas compartilhadas contam em cada processo)`
  )
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) {
  main()
}
