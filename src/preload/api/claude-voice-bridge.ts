import { ipcRenderer } from 'electron'
import type { ClaudeVoiceStatus } from '../../shared/claude-voice-status'

export type ClaudeVoiceApi = {
  getStatus: () => Promise<ClaudeVoiceStatus>
  toggle: () => Promise<ClaudeVoiceStatus>
  onChanged: (callback: (status: ClaudeVoiceStatus) => void) => () => void
}

export const claudeVoiceApi: ClaudeVoiceApi = {
  getStatus: () => ipcRenderer.invoke('claudeVoice:getStatus'),
  toggle: () => ipcRenderer.invoke('claudeVoice:toggle'),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ClaudeVoiceStatus): void =>
      callback(status)
    ipcRenderer.on('claudeVoice:changed', listener)
    return () => ipcRenderer.removeListener('claudeVoice:changed', listener)
  }
}
