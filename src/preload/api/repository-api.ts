import type {
  CanvasHierarchyDecision,
  CanvasHierarchyDecisionResult,
  CanvasHierarchySnapshot
} from '../../shared/canvas-hierarchy'
import type { CanvasContextTokens } from '../../shared/canvas-context-tokens'
import type { PcDeskHomeFolderListing } from '../../shared/pc-desk-home-folder-types'
import type {
  PcDeskSessionTitleRequest,
  PcDeskSessionTitleResult
} from '../../shared/pc-desk-session-title'
import type { RepoCreateFailure } from '../../shared/repo-create-failure-copy'
import type { ExecutionHostId } from '../../shared/execution-host'
import type { GhAccountBinding } from '../../shared/github/account-binding'
import type {
  NestedRepoScanResult,
  ProjectGroup,
  ProjectGroupImportMode,
  ProjectGroupImportResult
} from '../../shared/project-group-types'
import type {
  Project,
  ProjectHostSetup,
  ProjectHostSetupCreateArgs,
  ProjectHostSetupCreateResult,
  ProjectHostSetupDeleteArgs,
  ProjectHostSetupDeleteResult,
  ProjectHostSetupExistingFolderArgs,
  ProjectHostSetupResult,
  ProjectHostSetupUpdateArgs,
  ProjectHostSetupUpdateResult,
  ProjectUpdateArgs
} from '../../shared/project-types'
import type { BaseRefDefaultResult, BaseRefSearchResult, Repo } from '../../shared/repo-types'
import type { WslMovedProject } from '../../shared/wsl-move/wsl-moved-project'
import type { HostRepoCatalogSnapshot } from '../../shared/host-repo-catalog-snapshot'

export type RepositoryApi = {
  list: () => Promise<Repo[]>
  /** Local projects a WSL host now owns: read-only, listed only for their existing chats. */
  listWslMoved: () => Promise<WslMovedProject[]>
  /** Saved WSL host project lists by environment id; desktop-only, never contacts a host. */
  listHostCatalogSnapshots: () => Promise<Record<string, HostRepoCatalogSnapshot>>
  add: (args: {
    path: string
    kind?: 'git' | 'folder'
    displayName?: string
  }) => Promise<{ repo: Repo } | { error: string }>
  removeForHost: (args: { repoId: string; hostId: string }) => Promise<void>
  reorder: (args: { orderedIds: string[] }) => Promise<{ status: 'applied' | 'rejected' }>
  reorderForHost: (args: {
    orderedIds: string[]
    hostId: string
  }) => Promise<{ status: 'applied' | 'rejected' }>
  update: (args: {
    repoId: string
    hostId?: ExecutionHostId
    updates: Partial<
      Pick<
        Repo,
        | 'displayName'
        | 'badgeColor'
        | 'repoIcon'
        | 'upstream'
        | 'hookSettings'
        | 'editorFormatter'
        | 'worktreeBaseRef'
        | 'worktreeBasePath'
        | 'kind'
        | 'issueSourcePreference'
        | 'defaultJiraProject'
        | 'externalWorktreeVisibilityPromptDismissedAt'
        | 'externalWorktreeInboxBaselinePaths'
        | 'importedExternalWorktreePaths'
        | 'customWorktreeVisibilitySources'
        | 'worktreeVisibilitySourcePreferences'
        | 'projectGroupId'
        | 'projectGroupOrder'
        | 'forkSyncMode'
      >
    > & {
      externalWorktreeVisibility?: Repo['externalWorktreeVisibility'] | null
      agentWorktreeVisibility?: Repo['agentWorktreeVisibility'] | null
      sourceControlAi?: Repo['sourceControlAi'] | null
      externalWorktreeDiscoverySuppressedAt?: Repo['externalWorktreeDiscoverySuppressedAt'] | null
      ghAccount?: GhAccountBinding | null
    }
  }) => Promise<Repo>
  pickFolder: () => Promise<string | null>
  pickFolders: () => Promise<string[]>
  pickDirectory: () => Promise<string | null>
  clone: (args: { url: string; destination: string }) => Promise<Repo>
  cloneAbort: () => Promise<void>
  create: (args: {
    parentPath: string
    name: string
    kind: 'git' | 'folder'
  }) => Promise<{ repo: Repo } | RepoCreateFailure>
  isGitAvailable: () => Promise<boolean>
  getDefaultCreateProjectParent: () => Promise<string>
  /** Fork-only: subfolders of Desktop\Projetos for the PC-desk project switcher. */
  listPcDeskHomeFolders: () => Promise<PcDeskHomeFolderListing>
  /** Fork-only: asks Haiku whether a session tab needs a new name. */
  suggestPcDeskSessionTitle: (
    request: PcDeskSessionTitleRequest
  ) => Promise<PcDeskSessionTitleResult>
  /** Fork-only: Haiku summary (1-2 lines) of a chat's latest reply for the flowchart card. */
  summarizeCanvasReply: (request: {
    cwd: string
    text: string
  }) => Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }>
  /** Fork-only: Haiku's one or two word job title for an executor chat's round flowchart card. */
  nameCanvasExecutor: (request: {
    cwd: string
    text: string
  }) => Promise<{ kind: 'ok'; summary: string } | { kind: 'error'; error: string }>
  /** Fork-only: still picture of a chat's localhost page or claude.ai artifact, for its flowchart card. */
  captureCanvasPagePreview: (
    url: string
  ) => Promise<{ kind: 'ok'; dataUrl: string } | { kind: 'error'; error: string }>
  /** Fork-only: each folder's chat hierarchy (PO > planner > executor), for the flowchart. */
  readCanvasHierarchy: (folders: string[]) => Promise<CanvasHierarchySnapshot[]>
  /** Fork-only: tokens in each chat's context, read from its Claude transcript, for the flowchart. */
  readCanvasContextTokens: (transcriptPaths: string[]) => Promise<CanvasContextTokens>
  /** Fork-only: an image file a chat printed, as a thumbnail or full picture, for the flowchart. */
  readCanvasImage: (request: {
    path: string
    size: 'thumb' | 'full'
  }) => Promise<{ kind: 'ok'; dataUrl: string } | { kind: 'error'; error: string }>
  /** Fork-only: the user's OK or send-back on a delivery, from the flowchart queue. */
  decideCanvasHierarchyOrder: (
    decision: CanvasHierarchyDecision
  ) => Promise<CanvasHierarchyDecisionResult>
  /** Fork-only: lets main name phone workspace rows like the PC-desk sidebar. */
  setPcDeskSmartTitles: (enabled: boolean) => Promise<void>
  onCloneProgress: (callback: (data: { phase: string; percent: number }) => void) => () => void
  getBaseRefDefault: (args: {
    repoId: string
    hostId?: ExecutionHostId
  }) => Promise<BaseRefDefaultResult>
  searchBaseRefs: (args: {
    repoId: string
    query: string
    limit?: number
    hostId?: ExecutionHostId
  }) => Promise<string[]>
  searchBaseRefDetails: (args: {
    repoId: string
    query: string
    limit?: number
    hostId?: ExecutionHostId
  }) => Promise<BaseRefSearchResult[]>
  onChanged: (callback: () => void) => () => void
}

export type ProjectsApi = {
  list: () => Promise<Project[]>
  update: (args: ProjectUpdateArgs) => Promise<Project | null>
  listHostSetups: () => Promise<ProjectHostSetup[]>
  createHostSetup: (args: ProjectHostSetupCreateArgs) => Promise<ProjectHostSetupCreateResult>
  setupExistingFolder: (args: ProjectHostSetupExistingFolderArgs) => Promise<ProjectHostSetupResult>
  updateHostSetup: (args: ProjectHostSetupUpdateArgs) => Promise<ProjectHostSetupUpdateResult>
  deleteHostSetup: (args: ProjectHostSetupDeleteArgs) => Promise<ProjectHostSetupDeleteResult>
}

export type ProjectGroupsApi = {
  list: () => Promise<ProjectGroup[]>
  create: (args: {
    name: string
    parentPath?: string | null
    connectionId?: string | null
    parentGroupId?: string | null
    createdFrom?: ProjectGroup['createdFrom']
  }) => Promise<ProjectGroup>
  update: (args: {
    groupId: string
    updates: Partial<Pick<ProjectGroup, 'name' | 'isCollapsed' | 'tabOrder' | 'color'>>
  }) => Promise<ProjectGroup | null>
  delete: (args: { groupId: string }) => Promise<boolean>
  moveProject: (args: {
    projectId: string
    groupId: string | null
    order?: number
    hostId?: string
  }) => Promise<Repo | null>
  scanNested: (args: {
    path: string
    connectionId?: string
    scanId?: string
    options?: Record<string, unknown>
  }) => Promise<NestedRepoScanResult>
  cancelNestedScan: (args: { scanId: string }) => Promise<boolean>
  onNestedScanProgress: (
    callback: (data: { scanId: string; scan: NestedRepoScanResult }) => void
  ) => () => void
  importNested: (args: {
    parentPath: string
    groupName: string
    projectPaths: string[]
    connectionId?: string
    scanId?: string
    mode: ProjectGroupImportMode
  }) => Promise<ProjectGroupImportResult>
}
