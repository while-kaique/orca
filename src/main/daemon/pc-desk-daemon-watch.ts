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

import { monitorEventLoopDelay } from 'node:perf_hooks'
import type { DaemonFileLog } from './daemon-file-log'

const HEARTBEAT_MS = 30_000
const MB = 1024 * 1024

/** Roda dentro do daemon. Fail-open: qualquer erro aqui só desliga o monitoramento. */
export function startDaemonHeartbeat(log: DaemonFileLog): void {
  try {
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
          loopLagMaxMs: Math.round(lag.max / 1e6),
          loopLagP99Ms: Math.round(lag.percentile(99) / 1e6)
        })
        lag.reset()
      } catch {
        // monitoramento nunca derruba o daemon
      }
    }, HEARTBEAT_MS)
    timer.unref()
    process.on('exit', (code) => {
      log.log('process-exit', { code, uptimeS: Math.round(process.uptime()) })
    })
  } catch {
    // idem
  }
}
