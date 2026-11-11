import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { ipcMain } from 'electron'
import {
  contextTokensFromTranscriptTail,
  type CanvasContextTokens
} from '../../../shared/canvas-context-tokens'
import { isTrustedBrowserRenderer } from '../browser/browser-renderer-trust'

// Fork: the flowchart's context meter reads each chat's Claude transcript instead of a status line.

const TAIL_BYTES = 400_000
const MAX_TRANSCRIPTS = 200

function isClaudeTranscript(path: string): boolean {
  const root = `${join(homedir(), '.claude', 'projects')}${sep}`.toLowerCase()
  return path.endsWith('.jsonl') && resolve(path).toLowerCase().startsWith(root)
}

async function readTail(path: string): Promise<string | null> {
  try {
    const file = await open(path, 'r')
    try {
      const { size } = await file.stat()
      const span = Math.min(size, TAIL_BYTES)
      const buffer = Buffer.alloc(span)
      await file.read(buffer, 0, span, size - span)
      return buffer.toString('utf8')
    } finally {
      await file.close()
    }
  } catch {
    // A chat that has not written its transcript yet, or one that was deleted.
    return null
  }
}

export async function readCanvasContextTokens(
  paths: readonly string[]
): Promise<CanvasContextTokens> {
  const tokens: CanvasContextTokens = {}
  const wanted = [...new Set(paths)].filter(isClaudeTranscript).slice(0, MAX_TRANSCRIPTS)
  await Promise.all(
    wanted.map(async (path) => {
      const tail = await readTail(path)
      const count = tail === null ? null : contextTokensFromTranscriptTail(tail)
      if (count !== null) {
        tokens[path] = count
      }
    })
  )
  return tokens
}

export function registerCanvasContextTokensHandler(): void {
  ipcMain.removeHandler('repos:readCanvasContextTokens')
  ipcMain.handle('repos:readCanvasContextTokens', (event, paths: unknown) =>
    isTrustedBrowserRenderer(event.sender) &&
    Array.isArray(paths) &&
    paths.every((path) => typeof path === 'string')
      ? readCanvasContextTokens(paths)
      : Promise.resolve({})
  )
}
