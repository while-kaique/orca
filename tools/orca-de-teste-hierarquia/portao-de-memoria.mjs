// Portao de memoria (decisao do PO na o-043): so abre Orca de teste com 9 GB livres e nenhum outro Orca de teste vivo
// na maquina. Sem isso, espera 5 min e mede de novo, por ate 90 min, sem ocupar a maquina (so um relogio parado).
// Uso: node tools/orca-de-teste-hierarquia/portao-de-memoria.mjs [ARQUIVO_DE_LOG]   (sai 0 = pode, 1 = nao abriu)
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

export const MINIMO_LIVRE_GB = 9
const ESPERA_MS = 5 * 60_000
const PRAZO_MS = 90 * 60_000

/** Memoria livre (GB) e os Orcas de teste vivos (programa principal com porta de depuracao: o Orca em uso nao tem). */
export function medir() {
  const saida = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$o=Get-CimInstance Win32_OperatingSystem; 'livre ' + [math]::Round($o.FreePhysicalMemory/1MB,1); Get-CimInstance Win32_Process -Filter \"Name='electron.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine -notmatch '--type=' -and $_.CommandLine -match '--remote-debugging-port' } | ForEach-Object { 'teste ' + $_.ProcessId }"
    ],
    { encoding: 'utf8', windowsHide: true }
  )
  const linhas = saida.split(/\r?\n/u).filter(Boolean)
  const livre = Number(
    (linhas.find((l) => l.startsWith('livre ')) ?? 'livre 0').slice(6).replace(',', '.')
  )
  const testes = linhas.filter((l) => l.startsWith('teste ')).map((l) => Number(l.slice(6)))
  return { livreGB: livre, orcasDeTeste: testes }
}

if (import.meta.main) {
  const log = process.argv[2]
  const dizer = (texto) => {
    const linha = `${new Date().toISOString()} ${texto}`
    console.log(linha)
    if (log) {
      appendFileSync(log, `${linha}\n`)
    }
  }
  const inicio = Date.now()
  for (;;) {
    const agora = medir()
    const pode = agora.livreGB >= MINIMO_LIVRE_GB && agora.orcasDeTeste.length === 0
    dizer(
      `${agora.livreGB} GB livres; Orcas de teste vivos: ${agora.orcasDeTeste.length ? agora.orcasDeTeste.join(', ') : 'nenhum'} -> ${pode ? 'PODE' : 'espera'}`
    )
    if (pode) {
      process.exit(0)
    }
    if (Date.now() - inicio + ESPERA_MS > PRAZO_MS) {
      dizer('90 min sem memoria: nao abre')
      process.exit(1)
    }
    await new Promise((pronto) => setTimeout(pronto, ESPERA_MS))
  }
}
