// Fork "PC como mesa": monitoramento de quedas do serviço de terminais (daemon).
// Em 25/09/2026 o daemon morreu 4 vezes sem deixar linha nenhuma no daemon.log
// (nem shutdown, nem uncaught-exception) e o app subiu outro, remontando todos os
// chats. Estes registros existem para a próxima queda dizer o porquê:
//   - daemon.log  → 'heartbeat' a cada 30 s (memória + atraso do laço de eventos) e
//                   'process-exit' quando o processo sai pelo caminho normal do Node.
//                   Heartbeat parando sem 'process-exit' = morte nativa ou kill externo.
//   - daemon-watch.log (escrito pelo app) → 'daemon-respawn' com o motivo, o pid antigo
//                   e se ele ainda estava vivo (vivo = travado, não morto).
// Nunca registra conteúdo de terminal. Este arquivo roda DENTRO do daemon (Node puro):
// não importar nada que dependa do Electron. O lado do app fica em pc-desk-daemon-respawn-log.ts.

import { dirname } from 'node:path'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { getHeapStatistics, setHeapSnapshotNearHeapLimit, writeHeapSnapshot } from 'node:v8'
import type { DaemonFileLog } from './daemon-file-log'
import {
  appendSnapshotHistory,
  configureSnapshotBreadcrumb,
  getSnapshotInFlight
} from './pc-desk-snapshot-breadcrumb'
import { startPulse } from './pc-desk-pulse'

const HEARTBEAT_MS = 30_000
const MB = 1024 * 1024
const GUARD_MS = 1_000
const GUARD_WARN_MB = 1_000
const GUARD_DUMP_MB = 1_500

/** Roda dentro do daemon. Fail-open: qualquer erro aqui só desliga o monitoramento. */
export function startDaemonHeartbeat(log: DaemonFileLog, logFilePath?: string): void {
  try {
    // 06/10: o daemon saiu com 134 (abort fatal do Node) 3x; o relatório traz pilha nativa e JS.
    if (logFilePath && process.report) {
      process.report.directory = dirname(logFilePath)
      process.report.reportOnFatalError = true
    }
    if (logFilePath) {
      configureSnapshotBreadcrumb(dirname(logFilePath))
      // 08/10: estouro de memória súbito; grava Heap-*.heapsnapshot na pasta de trabalho do daemon (userData).
      setHeapSnapshotNearHeapLimit(1)
    }
    if (logFilePath) {
      startHeapGuard(dirname(logFilePath))
      startPulse(dirname(logFilePath))
    }
    const lag = monitorEventLoopDelay({ resolution: 50 })
    lag.enable()
    const timer = setInterval(() => {
      try {
        const mem = process.memoryUsage()
        log.log('heartbeat', {
          uptimeS: Math.round(process.uptime()),
          rssMB: Math.round(mem.rss / MB),
          heapUsedMB: Math.round(mem.heapUsed / MB),
          externalMB: Math.round(mem.external / MB),
          handles: process.getActiveResourcesInfo().length,
          loopLagMaxMs: Math.round(lag.max / 1e6),
          loopLagP99Ms: Math.round(lag.percentile(99) / 1e6)
        })
        lag.reset()
      } catch {
        // monitoramento nunca derruba o daemon
      }
    }, HEARTBEAT_MS)
    timer.unref()
    let exitLogged = false
    const logProcessExit = (code: number | string | null | undefined): void => {
      if (!exitLogged) {
        exitLogged = true
        log.log('process-exit', { code, uptimeS: Math.round(process.uptime()) })
      }
    }
    // Why wrap close: since 1.4.249 writes are async and paths like the shutdown deadline close the
    // log before process.exit; a line written after close is dropped and would read as a crash.
    const closeLog = log.close.bind(log)
    log.close = () => {
      logProcessExit(process.exitCode ?? null)
      closeLog()
    }
    process.on('exit', (code) => logProcessExit(code))
  } catch {
    // idem
  }
}

// 09/10: o heap vai de ~30 MB a 4 GB em <50 s, rápido demais para o heartbeat de 30 s e para o aviso do V8.
function startHeapGuard(dir: string): void {
  let warned = false
  let dumped = false
  const timer = setInterval(() => {
    try {
      const usedMB = getHeapStatistics().used_heap_size / MB
      if (!warned && usedMB > GUARD_WARN_MB) {
        warned = true
        appendSnapshotHistory(
          `${new Date().toISOString()} ALERTA-MEMORIA pid=${process.pid} heapMB=${Math.round(usedMB)} ` +
            `fotografando=${getSnapshotInFlight() ?? 'nenhuma'}
`
        )
      }
      if (!dumped && usedMB > GUARD_DUMP_MB) {
        dumped = true
        const file = writeHeapSnapshot(`${dir}/Heap-guarda-${Date.now()}.heapsnapshot`)
        appendSnapshotHistory(`${new Date().toISOString()} FOTO-HEAP ${file}
`)
      }
    } catch {
      // monitoramento nunca derruba o daemon
    }
  }, GUARD_MS)
  timer.unref()
}
