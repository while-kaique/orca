import type {
  CanvasHierarchyDecision,
  CanvasHierarchyDecisionResult,
  CanvasHierarchySnapshot
} from '../../shared/canvas-hierarchy'
import type { CanvasChatModels } from '../../shared/canvas-chat-transcript-model'
import type { CanvasContextTokens } from '../../shared/canvas-context-tokens'
import { ipcRenderer } from 'electron'
import type { BaseRefDefaultResult, BaseRefSearchResult } from '../../shared/repo-types'
import type { ExecutionHostId } from '../../shared/execution-host'
import type { PreloadApi } from '../api-types'
import type { PcDeskHomeFolderListing } from '../../shared/pc-desk-home-folder-types'
import type {
  PcDeskSessionTitleRequest,
  PcDeskSessionTitleResult
} from '../../shared/pc-desk-session-title'

export const reposApi = {
  list: () => ipcRenderer.invoke('repos:list'),

  listWslMoved: () => ipcRenderer.invoke('repos:listWslMoved'),

  listHostCatalogSnapshots: () => ipcRenderer.invoke('repos:listHostCatalogSnapshots'),

  add: (args) => ipcRenderer.invoke('repos:add', args),

  create: (args) => ipcRenderer.invoke('repos:create', args),

  isGitAvailable: (): Promise<boolean> => ipcRenderer.invoke('repos:isGitAvailable'),

  getDefaultCreateProjectParent: (): Promise<string> =>
    ipcRenderer.invoke('repos:getDefaultCreateProjectParent'),

  listPcDeskHomeFolders: (): Promise<PcDeskHomeFolderListing> =>
    ipcRenderer.invoke('repos:listPcDeskHomeFolders'),

  suggestPcDeskSessionTitle: (
    request: PcDeskSessionTitleRequest
  ): Promise<PcDeskSessionTitleResult> =>
    ipcRenderer.invoke('repos:suggestPcDeskSessionTitle', request),
  summarizeCanvasReply: (request: {
    cwd: string
    text: string
  }): Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }> =>
    ipcRenderer.invoke('repos:summarizeCanvasReply', request),
  nameCanvasExecutor: (request: {
    cwd: string
    text: string
    role?: 'executor' | 'planejador'
  }): Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }> =>
    ipcRenderer.invoke('repos:nameCanvasExecutor', request),
  captureCanvasPagePreview: (
    url: string
  ): Promise<{ kind: 'ok'; dataUrl: string } | { kind: 'error'; error: string }> =>
    ipcRenderer.invoke('repos:captureCanvasPagePreview', url),
  readCanvasHierarchy: (folders: string[]): Promise<CanvasHierarchySnapshot[]> =>
    ipcRenderer.invoke('repos:readCanvasHierarchy', folders),
  readCanvasContextTokens: (transcriptPaths: string[]): Promise<CanvasContextTokens> =>
    ipcRenderer.invoke('repos:readCanvasContextTokens', transcriptPaths),
  readCanvasChatModels: (transcriptPaths: string[]): Promise<CanvasChatModels> =>
    ipcRenderer.invoke('repos:readCanvasChatModels', transcriptPaths),
  readCanvasImage: (request: {
    path: string
    size: 'thumb' | 'full'
  }): Promise<{ kind: 'ok'; dataUrl: string } | { kind: 'error'; error: string }> =>
    ipcRenderer.invoke('repos:readCanvasImage', request),
  decideCanvasHierarchyOrder: (
    decision: CanvasHierarchyDecision
  ): Promise<CanvasHierarchyDecisionResult> =>
    ipcRenderer.invoke('repos:decideCanvasHierarchyOrder', decision),
  closeCanvasHierarchyChat: (tabId: string, folders: string[]): Promise<void> =>
    ipcRenderer.invoke('repos:closeCanvasHierarchyChat', tabId, folders),
  setPcDeskSmartTitles: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('repos:setPcDeskSmartTitles', enabled),

  removeForHost: (args) => ipcRenderer.invoke('repos:removeForHost', args),

  reorder: (args) => ipcRenderer.invoke('repos:reorder', args),

  reorderForHost: (args) => ipcRenderer.invoke('repos:reorderForHost', args),

  update: (args) => ipcRenderer.invoke('repos:update', args),

  pickFolder: () => ipcRenderer.invoke('repos:pickFolder'),

  pickFolders: () => ipcRenderer.invoke('repos:pickFolders'),

  pickDirectory: () => ipcRenderer.invoke('repos:pickDirectory'),

  clone: (args) => ipcRenderer.invoke('repos:clone', args),

  cloneAbort: () => ipcRenderer.invoke('repos:cloneAbort'),

  onCloneProgress: (callback: (data: { phase: string; percent: number }) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { phase: string; percent: number }
    ) => callback(data)
    ipcRenderer.on('repos:clone-progress', listener)
    return () => ipcRenderer.removeListener('repos:clone-progress', listener)
  },

  getBaseRefDefault: (args: {
    repoId: string
    hostId?: ExecutionHostId
  }): Promise<BaseRefDefaultResult> => ipcRenderer.invoke('repos:getBaseRefDefault', args),

  searchBaseRefs: (args: {
    repoId: string
    query: string
    limit?: number
    hostId?: ExecutionHostId
  }): Promise<string[]> => ipcRenderer.invoke('repos:searchBaseRefs', args),

  searchBaseRefDetails: (args: {
    repoId: string
    query: string
    limit?: number
    hostId?: ExecutionHostId
  }): Promise<BaseRefSearchResult[]> => ipcRenderer.invoke('repos:searchBaseRefDetails', args),

  onChanged: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('repos:changed', listener)
    return () => ipcRenderer.removeListener('repos:changed', listener)
  }
} satisfies PreloadApi['repos']
