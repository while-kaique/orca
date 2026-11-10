import { execFile } from 'node:child_process'
import { existsSync, watch, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import type { ClaudeVoiceStatus } from '../../shared/claude-voice-status'

// Fork: toggles the local Claude text-to-speech hook (~/.claude/hooks/falar.py), shared with the global Ctrl+Alt+V shortcut.
const VOICE_DIR = join(homedir(), '.claude', 'voz')
const MUTE_FILE = join(VOICE_DIR, 'mudo')
const SPEAK_SCRIPT = join(homedir(), '.claude', 'hooks', 'falar.py')

function readStatus(): ClaudeVoiceStatus {
  return { installed: existsSync(SPEAK_SCRIPT), muted: existsSync(MUTE_FILE) }
}

function broadcast(status: ClaudeVoiceStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('claudeVoice:changed', status)
    }
  }
}

function runToggle(): Promise<void> {
  return new Promise((resolve) => {
    execFile('python', [SPEAK_SCRIPT, '--alternar'], { windowsHide: true, timeout: 15_000 }, () =>
      resolve()
    )
  })
}

export function registerClaudeVoiceHandlers(): void {
  ipcMain.handle('claudeVoice:getStatus', () => readStatus())
  ipcMain.handle('claudeVoice:toggle', async () => {
    if (!readStatus().installed) {
      return readStatus()
    }
    await runToggle()
    const status = readStatus()
    broadcast(status)
    return status
  })

  if (!existsSync(VOICE_DIR)) {
    return
  }
  let last = readStatus().muted
  let watcher: FSWatcher | null = null
  try {
    watcher = watch(VOICE_DIR, (_event, file) => {
      if (file !== 'mudo') {
        return
      }
      const status = readStatus()
      if (status.muted !== last) {
        last = status.muted
        broadcast(status)
      }
    })
    watcher.on('error', () => watcher?.close())
  } catch {
    watcher = null
  }
}
