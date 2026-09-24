// Fork-only: the "home" folder whose subfolders are the user's projects (PC-desk mode switcher).

/** 'repo' = has a .git folder; 'worktree' = .git file (a linked checkout of another repo). */
export type PcDeskHomeFolderGitKind = 'repo' | 'worktree' | null

export type PcDeskHomeFolderEntry = {
  name: string
  path: string
  gitKind: PcDeskHomeFolderGitKind
  modifiedAt: number
}

export type PcDeskHomeFolderListing = {
  rootPath: string
  entries: PcDeskHomeFolderEntry[]
  error?: string
}
