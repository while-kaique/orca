import { useSyncExternalStore } from 'react'

/** Fork: claude.ai artifact links each chat printed, kept across restarts; the card's X dismisses one. */
type Stored = {
  links: Record<string, string[]>
  dismissed: string[]
  /** Local ports each chat mentioned (e.g. "rodando em localhost:1976"), to tie servers to the chat. */
  ports?: Record<string, number[]>
}

const STORAGE_KEY = 'orca-fork.canvas-chat-artifacts'
const ARTIFACT_LINK = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]{6,}/g
const LOCAL_PORT = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/g
const listeners = new Set<() => void>()
let stored: Stored = readStored()
const EMPTY: readonly string[] = []

function readStored(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : { links: {}, dismissed: [] }
  } catch {
    return { links: {}, dismissed: [] }
  }
}

function save(next: Stored): void {
  stored = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: links still show for this session.
  }
  listeners.forEach((listener) => listener())
}

/** Picks artifact links out of a chat's raw terminal text (before escape codes are stripped, so OSC 8 links count too). */
export function noteCanvasChatArtifacts(tabId: string, rawTerminalText: string): void {
  const found = [...new Set(rawTerminalText.match(ARTIFACT_LINK) ?? [])]
  const known = stored.links[tabId] ?? []
  const fresh = found.filter((url) => !known.includes(url))
  const ports = [
    ...new Set(
      [...rawTerminalText.matchAll(LOCAL_PORT)]
        .map((m) => Number(m[1]))
        .filter((p) => p > 0 && p < 65536)
    )
  ]
  const knownPorts = stored.ports?.[tabId] ?? []
  const freshPorts = ports.filter((p) => !knownPorts.includes(p))
  if (fresh.length > 0 || freshPorts.length > 0) {
    save({
      ...stored,
      links: { ...stored.links, [tabId]: [...known, ...fresh] },
      ports: { ...stored.ports, [tabId]: [...knownPorts, ...freshPorts] }
    })
  }
}

export function portsMentionedByTab(links: CanvasArtifactLinks, tabId: string): readonly number[] {
  return links.ports?.[tabId] ?? []
}

export function dismissCanvasChatArtifact(url: string): void {
  save({ ...stored, dismissed: [...stored.dismissed, url] })
}

export type CanvasArtifactLinks = Stored

/** Snapshot of every chat's artifact links; the flowchart lays them out as sub-cards. */
export function useCanvasArtifactLinks(): CanvasArtifactLinks {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => stored
  )
}

export function artifactLinksForTab(links: CanvasArtifactLinks, tabId: string): readonly string[] {
  return (links.links[tabId] ?? EMPTY).filter((url) => !links.dismissed.includes(url))
}
