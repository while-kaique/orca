import { browserUrlForPort } from '@/lib/workspace-ports/workspace-port-urls'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import {
  artifactLinksForTab,
  imagesForTab,
  pageForPort,
  portsMentionedByTab,
  type CanvasArtifactLinks
} from './canvas-chat-artifacts'
import type { CanvasExtra } from './canvas-chats-layout'

/** Servers whose URL this chat's terminal printed, plus the claude.ai artifacts and image files it showed. */
export function chatExtras(
  links: CanvasArtifactLinks,
  ports: readonly WorkspacePort[],
  tabId: string,
  ptyIds: readonly string[],
  allPorts: readonly WorkspacePort[],
  owner: { repoId: string; worktreeId: string }
): CanvasExtra[] {
  const extras: CanvasExtra[] = []
  const mentioned = portsMentionedByTab(links, tabId)
  const seen = new Set<number>()
  const push = (port: WorkspacePort, repoId: string, worktreeId: string): void => {
    if (seen.has(port.port)) {
      return
    }
    seen.add(port.port)
    const url = pageForPort(links, tabId, port.port) ?? browserUrlForPort(port)
    extras.push({
      id: `${tabId}::server:${port.port}`,
      kind: 'server',
      label: url.replace(/^https?:\/\//u, ''),
      url,
      ...(port.pid ? { server: { repoId, worktreeId, pid: port.pid, port: port.port } } : {})
    })
  }
  for (const port of ports) {
    // Tied to this chat when its terminal printed the URL, or the conversation mentions the port.
    if (port.kind !== 'workspace') {
      continue
    }
    const printedHere =
      port.advertisedByPtyId !== undefined && ptyIds.includes(port.advertisedByPtyId)
    if (printedHere || mentioned.includes(port.port)) {
      push(port, port.owner.repoId, port.owner.worktreeId)
    }
  }
  // Folder workspaces (e.g. Desktop\Projetos) get no port owner from Orca: match mentioned ports machine-wide.
  for (const port of allPorts) {
    if (mentioned.includes(port.port) && port.kind !== 'container') {
      push(port, owner.repoId, owner.worktreeId)
    }
  }
  for (const url of artifactLinksForTab(links, tabId)) {
    extras.push({
      id: `${tabId}::artifact:${url}`,
      kind: 'artifact',
      label: `artifact ${url.split('/').pop()?.slice(0, 10) ?? ''}`,
      url
    })
  }
  for (const path of imagesForTab(links, tabId)) {
    extras.push({
      id: `${tabId}::image:${path}`,
      kind: 'image',
      label: path.split(/[\\/]/u).pop() ?? path,
      url: path
    })
  }
  return extras
}
