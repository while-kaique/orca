// Fork "PC como mesa": pulso do daemon, gravado por uma thread separada.
// 15/10/2026: na queda das 16:57 o heap foi de 22 MB ao limite com o laço de eventos TRAVADO:
// heartbeat (30 s) e vigia de 1 s rodam no laço principal e não anotaram nada; a foto do heap
// saiu com 0 byte. Aqui a thread principal só escreve na memória compartilhada (sem disco):
// a última operação que começou e quantos bytes cada terminal recebeu no último segundo.
// Uma worker thread, com laço próprio, lê isso a cada 1 s e grava em daemon-pulso.log,
// inclusive enquanto a principal está travada. Na próxima queda o log diz qual operação
// travou, de qual terminal, e a memória crescendo segundo a segundo.
// Nunca grava conteúdo de terminal. Roda DENTRO do daemon (Node puro).

import { join } from 'node:path'
import { Worker } from 'node:worker_threads'

const OP_BYTES = 512
const TOP_BYTES = 1024
// Int32: [0] seq da operação, [1] tamanho do texto da operação, [2] tamanho do resumo,
// [3] hora (s desde o início) em que a operação começou. Texto: operação e resumo.
const HEADER = 16
const encoder = new TextEncoder()

let ints: Int32Array | null = null
let opText: Uint8Array | null = null
let topText: Uint8Array | null = null
const bytesBySession = new Map<string, number>()
const startedAt = Date.now()

function writeText(target: Uint8Array, lenSlot: number, text: string): void {
  if (!ints) {
    return
  }
  const { written } = encoder.encodeInto(text, target)
  Atomics.store(ints, lenSlot, written ?? 0)
}

/** Marca a operação que está começando. Barato: só memória, sem disco. */
export function markPulse(op: string, sessionId?: string): void {
  if (!ints || !opText) {
    return
  }
  try {
    writeText(opText, 1, sessionId ? `${op} ${sessionId}` : op)
    Atomics.store(ints, 3, Math.round((Date.now() - startedAt) / 1000))
    Atomics.add(ints, 0, 1)
  } catch {
    // monitoramento nunca derruba o daemon
  }
}

/** Conta bytes recebidos do terminal; o resumo do último segundo vai para a memória compartilhada. */
export function countPtyBytes(sessionId: string, bytes: number): void {
  if (!ints) {
    return
  }
  bytesBySession.set(sessionId, (bytesBySession.get(sessionId) ?? 0) + bytes)
  markPulse(`pty-data ${bytes}B`, sessionId)
}

const WORKER_SOURCE = `
const { workerData } = require('node:worker_threads')
const { appendFileSync, writeFileSync, statSync, renameSync } = require('node:fs')
const { sab, logPath, nowPath, startedAt, mainPid } = workerData
const ints = new Int32Array(sab, 0, 4)
const bytes = new Uint8Array(sab)
const dec = new TextDecoder()
const read = (off, len) => dec.decode(bytes.slice(off, off + len))
let lastSeq = -1, stuck = 0, lastRssMB = 0, lastLine = 0
setInterval(() => {
  try {
    const seq = Atomics.load(ints, 0)
    const op = read(${HEADER}, Atomics.load(ints, 1))
    const top = read(${HEADER + OP_BYTES}, Atomics.load(ints, 2))
    const opAgeS = Math.round((Date.now() - startedAt) / 1000) - Atomics.load(ints, 3)
    stuck = seq === lastSeq ? stuck + 1 : 0
    lastSeq = seq
    const rssMB = Math.round(process.memoryUsage.rss() / 1048576)
    const now = new Date().toISOString()
    const line = now + ' pid=' + mainPid + ' rssMB=' + rssMB + ' parado=' + stuck + 's' +
      ' ultimaOp="' + op + '" haS=' + opAgeS + ' ultimoSegundo=[' + top + ']\\n'
    writeFileSync(nowPath, line)
    // Histórico: sempre que a memória mexe, quando o laço principal parece travado, ou a cada 60 s.
    if (Math.abs(rssMB - lastRssMB) >= 50 || rssMB >= 800 || stuck >= 2 || Date.now() - lastLine >= 60000) {
      try { if (statSync(logPath).size > 4194304) renameSync(logPath, logPath + '.1') } catch {}
      appendFileSync(logPath, line)
      lastRssMB = rssMB
      lastLine = Date.now()
    }
  } catch {}
}, 1000)
`

/** Liga o pulso. Fail-open: se a worker não subir, só não há pulso. */
export function startPulse(logsDir: string): void {
  try {
    const sab = new SharedArrayBuffer(HEADER + OP_BYTES + TOP_BYTES)
    ints = new Int32Array(sab, 0, 4)
    opText = new Uint8Array(sab, HEADER, OP_BYTES)
    topText = new Uint8Array(sab, HEADER + OP_BYTES, TOP_BYTES)
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        sab,
        logPath: join(logsDir, 'daemon-pulso.log'),
        nowPath: join(logsDir, 'daemon-pulso-atual.txt'),
        startedAt,
        mainPid: process.pid
      },
      resourceLimits: { maxOldGenerationSizeMb: 32 }
    })
    worker.unref()
    worker.on('error', () => {})
    const timer = setInterval(() => {
      try {
        const top = [...bytesBySession.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([id, n]) => `${id}=${n}B`)
          .join(' ')
        bytesBySession.clear()
        if (topText) {
          writeText(topText, 2, top)
        }
      } catch {
        // idem
      }
    }, 1000)
    timer.unref()
    markPulse('daemon-start')
  } catch {
    ints = null
  }
}
