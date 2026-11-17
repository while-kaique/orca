// Fork (o-043): the time of each step of a close by X, so a slow close shows where it waited.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** Each step of a fork close, timed, so a slow close shows where it waited. */
export function marcarTempoDoX(passo: string): void {
  try {
    if (process.env.ORCA_FORK_FECHAR_PARA_CHATS === '1') {
      const linha = `${JSON.stringify({ passo, em: new Date().toISOString() })}\n`
      appendFileSync(join(app.getPath('userData'), 'fork-x-tempos.jsonl'), linha)
    }
  } catch {
    // Timing is evidence only.
  }
}
