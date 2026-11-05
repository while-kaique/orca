// Fork (PC-desk): the project-header behaviors, kept out of SectionHeader so the upstream file stays small.
import React from 'react'
import { isPcDeskModeEnabled } from '@/lib/pc-desk-mode'
import type { Repo } from '../../../../../../shared/repo-types'
import { isGitRepoKind } from '../../../../../../shared/repo-kind'
import { activateProjectFolder, RepoHeaderWorktreesMenu } from './repo-header-worktrees-menu'
import {
  RepoHeaderCreateWorkspaceButton,
  type RepoHeaderProjectActions
} from './repo-header-project-actions'

export { getPcDeskProjectContextMenuHandler as contextMenuHandler } from '../../pc-desk-switcher/pc-desk-project-menu-request'
export { PcDeskHeaderNewChatButton as NewChatButton } from '../../pc-desk-switcher/PcDeskHeaderNewChatButton'

/** The project this header opens in PC-desk mode, or null when the header keeps upstream behavior. */
export function headerRepo(isRepoHeader: boolean, repo: Repo | undefined): Repo | null {
  return isPcDeskModeEnabled() && isRepoHeader && repo ? repo : null
}

/** PC-desk mode makes the project name open its folder; elsewhere (and the chevron) it collapses. */
export function activateHeader(pcDeskRepo: Repo | null, toggleCollapse: () => void): void {
  if (pcDeskRepo) {
    activateProjectFolder(pcDeskRepo)
  } else {
    toggleCollapse()
  }
}

/** PC-desk mode swaps "new workspace" for the ⑂ worktrees menu (git projects only). */
export function CreateAction({
  pcDeskRepo,
  repo,
  label,
  pinHost,
  onCreateForRepo
}: {
  pcDeskRepo: Repo | null
  repo: Repo
  label: string
  pinHost: boolean
  onCreateForRepo: RepoHeaderProjectActions['onCreateForRepo']
}): React.JSX.Element | null {
  if (!pcDeskRepo) {
    return (
      <RepoHeaderCreateWorkspaceButton
        repo={repo}
        label={label}
        pinHost={pinHost}
        onCreateForRepo={onCreateForRepo}
      />
    )
  }
  return isGitRepoKind(pcDeskRepo) ? (
    <RepoHeaderWorktreesMenu
      repo={pcDeskRepo}
      label={label}
      pinHost={pinHost}
      onCreateForRepo={onCreateForRepo}
    />
  ) : null
}
