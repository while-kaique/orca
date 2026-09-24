import { useAppStore } from '@/store'
import { closeTerminalTab } from '@/components/terminal/terminal-tab-actions'
import { createWorkspaceTabCloseCommands } from '@/components/tab-group/workspace-tab-close-commands'
import type { Repo } from '../../../../../shared/repo-types'

/** Closes every tab of the given workspaces, like closing each by hand. */
export function closePcDeskWorktrees(worktreeIds: readonly string[]): void {
  const state = useAppStore.getState()
  // Why deselect first: an emptied but still-selected workspace re-seeds a terminal, and closing the
  // visible pane mid-loop races its PTY exit (see sleep-worktree-flow.ts).
  if (state.activeWorktreeId && worktreeIds.includes(state.activeWorktreeId)) {
    state.setActiveWorktree(null)
  }
  for (const worktreeId of worktreeIds) {
    const tabs = [...(useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? [])]
    const { closeItem } = createWorkspaceTabCloseCommands({ worktreeId, groupTabs: tabs })
    for (const tab of tabs) {
      if (tab.contentType === 'terminal') {
        closeTerminalTab(tab.entityId, { force: true, skipRunningProcessConfirm: true })
      } else {
        // Why no force: unsaved files still get their save prompt.
        closeItem(tab.id, { skipEmptyCheck: true, skipRunningProcessConfirm: true })
      }
    }
    // Terminal tabs from older sessions may have no unified tab record.
    for (const tab of useAppStore.getState().tabsByWorktree[worktreeId] ?? []) {
      closeTerminalTab(tab.id, { force: true, skipRunningProcessConfirm: true })
    }
  }
}

/** "Take off the sidebar": closes the chats of every workspace of the project. */
export function closePcDeskProject(repo: Pick<Repo, 'id'>): void {
  const worktrees = useAppStore.getState().worktreesByRepo[repo.id] ?? []
  closePcDeskWorktrees(worktrees.map((worktree) => worktree.id))
}
