import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { splitWorktreeIdForFilesystem } from '../../../../shared/worktree/id'

/** Fork: a chat whose tab closed (its "x" or the sidebar) leaves its project's hierarchy; a closed PO frees the role. */
export function useCanvasHierarchyClosedTabWatch(): void {
  useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        if (state.tabsByWorktree === previous.tabsByWorktree) {
          return
        }
        const open = new Set(
          Object.values(state.tabsByWorktree).flatMap((tabs) => tabs.map((tab) => tab.id))
        )
        for (const [worktreeId, tabs] of Object.entries(previous.tabsByWorktree)) {
          const closed = tabs.filter((tab) => !open.has(tab.id))
          if (closed.length === 0) {
            continue
          }
          const parsed = splitWorktreeIdForFilesystem(worktreeId)
          // `.hierarquia/` lives in the project folder; a child worktree's chat belongs to its repo's.
          const folders = [
            parsed?.worktreePath,
            previous.repos.find((repo) => repo.id === parsed?.repoId)?.path
          ].filter((folder): folder is string => !!folder)
          for (const tab of closed) {
            void window.api.repos.closeCanvasHierarchyChat(tab.id, folders).catch(() => undefined)
          }
        }
      }),
    []
  )
}
