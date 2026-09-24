import { app, ipcMain } from 'electron'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  PcDeskHomeFolderEntry,
  PcDeskHomeFolderGitKind,
  PcDeskHomeFolderListing
} from '../../../shared/pc-desk-home-folder-types'

// Why fixed root: the renderer never names the directory, so this can't become a generic dir lister.
function getPcDeskHomeFolder(): string {
  return path.join(app.getPath('desktop'), 'Projetos')
}

async function readGitKind(dirPath: string): Promise<PcDeskHomeFolderGitKind> {
  try {
    const info = await stat(path.join(dirPath, '.git'))
    return info.isDirectory() ? 'repo' : 'worktree'
  } catch {
    return null
  }
}

async function readEntry(rootPath: string, name: string): Promise<PcDeskHomeFolderEntry | null> {
  const entryPath = path.join(rootPath, name)
  try {
    const [info, gitKind] = await Promise.all([stat(entryPath), readGitKind(entryPath)])
    return { name, path: entryPath, gitKind, modifiedAt: info.mtimeMs }
  } catch {
    return null
  }
}

const NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' })

export async function listPcDeskHomeFolders(): Promise<PcDeskHomeFolderListing> {
  const rootPath = getPcDeskHomeFolder()
  try {
    const dirents = await readdir(rootPath, { withFileTypes: true })
    const names = dirents
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map((dirent) => dirent.name)
    const entries = (await Promise.all(names.map((name) => readEntry(rootPath, name)))).filter(
      (entry): entry is PcDeskHomeFolderEntry => entry !== null
    )
    entries.sort((a, b) => NAME_COLLATOR.compare(a.name, b.name))
    return { rootPath, entries }
  } catch (error) {
    return {
      rootPath,
      entries: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function registerPcDeskHomeFolderHandlers(): void {
  ipcMain.handle('repos:listPcDeskHomeFolders', () => listPcDeskHomeFolders())
}
