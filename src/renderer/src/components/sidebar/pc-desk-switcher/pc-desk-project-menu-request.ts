import type React from 'react'
import { useSyncExternalStore } from 'react'

// Why module state: the project header is a render function (no hooks), so a right-click there
// asks the header's ⋯ menu component to open itself.
let requestedRepoId: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function requestPcDeskProjectMenu(repoId: string): void {
  requestedRepoId = repoId
  emit()
}

export function clearPcDeskProjectMenuRequest(): void {
  if (requestedRepoId !== null) {
    requestedRepoId = null
    emit()
  }
}

/** Right-click on a project header opens its ⋯ menu; undefined keeps the native menu elsewhere. */
export function getPcDeskProjectContextMenuHandler(
  repo: { id: string } | null
): React.MouseEventHandler | undefined {
  if (!repo) {
    return undefined
  }
  return (event) => {
    event.preventDefault()
    requestPcDeskProjectMenu(repo.id)
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePcDeskProjectMenuRequested(repoId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => requestedRepoId === repoId,
    () => false
  )
}
