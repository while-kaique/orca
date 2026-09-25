// Fork "PC como mesa": lado do app do monitoramento de quedas do daemon (ver
// pc-desk-daemon-watch.ts). Grava em logs/daemon-watch.log cada vez que o processo
// principal decide subir um daemon novo.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLogsDirectory } from '../observability/logs-directory'
import { createDaemonFileLog, type DaemonFileLog } from './daemon-file-log'
import { parseDaemonPidFile } from './daemon-pid-file-parse'

let watchLog: DaemonFileLog | null = null

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPid(pidPath: string): number | null {
  try {
    return parseDaemonPidFile(readFileSync(pidPath, 'utf8'))?.pid ?? null
  } catch {
    return null
  }
}

/** Roda no processo principal, no momento em que ele decide subir um daemon novo. */
export function logDaemonRespawn(reason: string, pidPath: string, manualRestart: boolean): void {
  try {
    const previousPid = readPid(pidPath)
    watchLog ??= createDaemonFileLog(join(getLogsDirectory(), 'daemon-watch.log'))
    watchLog.log('daemon-respawn', {
      from: 'main',
      reason,
      previousPid,
      previousPidAlive: previousPid ? isPidAlive(previousPid) : null,
      manualRestart
    })
  } catch {
    // fail-open
  }
}
