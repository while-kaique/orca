// Fork "PC como mesa": depois da partida, o stderr do daemon ia para o lixo. Quando o Node
// aborta (saída 134) ele escreve a pilha nativa e JS justamente ali, então guardamos em
// logs/daemon-stderr.log. unref: o pipe vivo não pode segurar o fechamento do Electron.

import { appendFile } from 'node:fs'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { getLogsDirectory } from '../observability/logs-directory'

const MAX_CHUNK_CHARS = 16_384

type UnrefableStream = Readable & { unref?: () => void }

export function keepDaemonStderrInFile(stream: UnrefableStream | null | undefined): void {
  if (!stream) {
    return
  }
  try {
    const file = join(getLogsDirectory(), 'daemon-stderr.log')
    stream.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').slice(-MAX_CHUNK_CHARS)
      appendFile(file, `[${new Date().toISOString()}] ${text}${text.endsWith('\n') ? '' : '\n'}`, () => {})
    })
    stream.on('error', () => {})
    stream.unref?.()
  } catch {
    stream.destroy()
  }
}
