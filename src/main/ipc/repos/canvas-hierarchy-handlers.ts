import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import type {
  CanvasHierarchyDecision,
  CanvasHierarchyDecisionResult,
  CanvasHierarchySnapshot
} from '../../../shared/canvas-hierarchy'
import { isTrustedBrowserRenderer } from '../browser/browser-renderer-trust'

// Fork: the flowchart shows each project's chat hierarchy from the file the `hierarquia` command writes.

const MAX_FOLDERS = 200
const DECISION_TIMEOUT_MS = 30_000

async function readSnapshot(folder: string): Promise<CanvasHierarchySnapshot | null> {
  try {
    const raw = JSON.parse(await readFile(join(folder, '.hierarquia', 'estado.json'), 'utf8'))
    if (!raw || typeof raw.chats !== 'object' || typeof raw.ordens !== 'object') {
      return null
    }
    return {
      folder,
      chats: raw.chats,
      ordens: raw.ordens,
      fila: Array.isArray(raw.fila) ? raw.fila : []
    }
  } catch {
    // No hierarchy in this folder (the usual case) or a file caught mid-write: nothing to show.
    return null
  }
}

export async function readCanvasHierarchy(
  folders: readonly string[]
): Promise<CanvasHierarchySnapshot[]> {
  const snapshots = await Promise.all(folders.slice(0, MAX_FOLDERS).map(readSnapshot))
  return snapshots.filter((snapshot): snapshot is CanvasHierarchySnapshot => snapshot !== null)
}

function hierarchyCommandPath(): string | null {
  const relative = join('skills', 'hierarquia', 'hierarquia.mjs')
  const candidates = [join(app.getAppPath(), relative), join(app.getAppPath(), '..', relative)]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/** The user's OK or send-back: the command applies the rules, so a chat cannot approve itself. */
export function decideCanvasHierarchyOrder(
  decision: CanvasHierarchyDecision
): Promise<CanvasHierarchyDecisionResult> {
  const command = hierarchyCommandPath()
  if (!command) {
    return Promise.resolve({ kind: 'error', error: 'hierarquia command not found' })
  }
  const args = [
    command,
    decision.decisao === 'ok' ? 'ok' : 'devolver',
    '--ordem',
    decision.ordemId,
    '--projeto',
    decision.folder,
    ...(decision.motivo ? ['--motivo', decision.motivo] : [])
  ]
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      args,
      {
        timeout: DECISION_TIMEOUT_MS,
        windowsHide: true,
        // Electron runs the script as plain Node; no chat identity, so the command sees the user.
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ORCA_TERMINAL_HANDLE: '' }
      },
      (error, _stdout, stderr) =>
        resolve(
          error ? { kind: 'error', error: (stderr || error.message).slice(0, 300) } : { kind: 'ok' }
        )
    )
  })
}

function isDecision(value: unknown): value is CanvasHierarchyDecision {
  const decision = value as Partial<CanvasHierarchyDecision> | null
  return (
    !!decision &&
    typeof decision.folder === 'string' &&
    typeof decision.ordemId === 'string' &&
    (decision.decisao === 'ok' || decision.decisao === 'devolver') &&
    (decision.motivo === undefined || typeof decision.motivo === 'string')
  )
}

export function registerCanvasHierarchyHandlers(): void {
  ipcMain.removeHandler('repos:readCanvasHierarchy')
  ipcMain.handle('repos:readCanvasHierarchy', (event, folders: unknown) =>
    isTrustedBrowserRenderer(event.sender) &&
    Array.isArray(folders) &&
    folders.every((folder) => typeof folder === 'string')
      ? readCanvasHierarchy(folders)
      : Promise.resolve([])
  )
  ipcMain.removeHandler('repos:decideCanvasHierarchyOrder')
  ipcMain.handle(
    'repos:decideCanvasHierarchyOrder',
    (event, decision: unknown): Promise<CanvasHierarchyDecisionResult> =>
      isTrustedBrowserRenderer(event.sender) && isDecision(decision)
        ? decideCanvasHierarchyOrder(decision)
        : Promise.resolve({ kind: 'error', error: 'untrusted' })
  )
}
