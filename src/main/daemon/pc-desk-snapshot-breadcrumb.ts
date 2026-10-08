// Fork "PC como mesa": marcador de qual terminal o daemon está fotografando agora.
// 08/10/2026: o daemon estoura a memória (20 MB → 4 GB em <30 s) durante um checkpoint
// (foto do terminal). Antes de cada foto grava o id da sessão num arquivo pequeno; depois,
// marca "ok". Se o daemon morrer no meio, o arquivo fica com o culpado.
// Fotos lentas (>2 s) ou que incham o heap (>100 MB) também viram linha em daemon-snapshot-lento.log.
// Nunca grava conteúdo de terminal. Roda DENTRO do daemon (Node puro).

import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

let logsDir: string | null = null

export function configureSnapshotBreadcrumb(dir: string): void {
  logsDir = dir
}

function safeWrite(file: string, text: string, append = false): void {
  if (!logsDir) {
    return
  }
  try {
    const path = join(logsDir, file)
    if (append) {
      appendFileSync(path, text)
    } else {
      writeFileSync(path, text)
    }
  } catch {
    // monitoramento nunca derruba o daemon
  }
}

export function withSnapshotBreadcrumb<T>(
  sessionId: string,
  size: { cols: number; rows: number } | null,
  take: () => T
): T {
  if (!logsDir) {
    return take()
  }
  const started = Date.now()
  const heapBefore = process.memoryUsage().heapUsed
  safeWrite(
    'daemon-snapshot-atual.txt',
    `FOTOGRAFANDO ${new Date(started).toISOString()} pid=${process.pid} sessao=${sessionId} ` +
      `tamanho=${size ? `${size.cols}x${size.rows}` : '?'} heapMB=${Math.round(heapBefore / 1048576)}\n`
  )
  const result = take()
  const ms = Date.now() - started
  const heapAfter = process.memoryUsage().heapUsed
  const heapGrewMB = (heapAfter - heapBefore) / 1048576
  if (ms > 2000 || heapGrewMB > 100) {
    let bytes = -1
    try {
      bytes = result ? JSON.stringify(result).length : 0
    } catch {
      // tamanho é só pista
    }
    safeWrite(
      'daemon-snapshot-lento.log',
      `${new Date().toISOString()} sessao=${sessionId} ms=${ms} chars=${bytes} ` +
        `heapMB=${Math.round(heapBefore / 1048576)}->${Math.round(heapAfter / 1048576)}\n`,
      true
    )
  }
  safeWrite(
    'daemon-snapshot-atual.txt',
    `ok ${new Date().toISOString()} ultima=${sessionId} ms=${ms}\n`
  )
  return result
}
