import { useSyncExternalStore } from 'react'

/** Fork: claude.ai artifact links each chat printed, kept across restarts; the card's X dismisses one. */
type Stored = {
  links: Record<string, string[]>
  dismissed: string[]
  /** Local ports each chat mentioned (e.g. "rodando em localhost:1976"), to tie servers to the chat. */
  ports?: Record<string, number[]>
  /** The full page address each chat showed per port (e.g. localhost:8799/relatorio/), opened instead of the bare port. */
  pages?: Record<string, Record<string, string>>
  /** Image files each chat printed (screenshots, generated art), newest last. */
  images?: Record<string, string[]>
}

const STORAGE_KEY = 'orca-fork.canvas-chat-artifacts'
// Whole ids only (22-char artifact ids, UUIDs for code artifacts): a link the terminal wrapped mid-id must not count.
const ARTIFACT_LINK =
  /https:\/\/claude\.ai\/(?:artifact\/[A-Za-z0-9]{20,24}|code\/artifact\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![A-Za-z0-9_-])/g
const WHOLE_ARTIFACT_LINK = new RegExp(`^(?:${ARTIFACT_LINK.source})$`)
const LOCAL_PORT = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/g
const LOCAL_PAGE =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})(\/[^\s"'<>()[\]{}]*)?/gu
// Whole absolute paths only (C:\… or /c/…): a path the terminal wrapped loses its start or its extension.
// A Windows path may hold single spaces ("Astra Designer"); it never holds a second drive colon.
const IMAGE_PATH =
  /(?:[A-Za-z]:[\\/](?:[^\s"'<>|*?`:()[\]{}]| (?=\S)){1,240}?|\/(?=[A-Za-z0-9._~-])[^\s"'<>|*?`:()[\]{}]{1,240}?)\.(?:png|jpe?g|webp|gif|bmp)(?![A-Za-z0-9])/giu
const MAX_IMAGES_PER_CHAT = 24
const ESCAPE_CODE_STARTS = [String.fromCharCode(27), String.fromCharCode(7)]

/** Latest address with a path the chat showed for each port; a wrap-cut copy loses to the longer one it starts. */
function pagesByPort(rawTerminalText: string): Record<string, string> {
  const pages: Record<string, string> = {}
  // The address ends where the escape code closing its color starts: turn ESC/BEL into spaces first.
  const text = ESCAPE_CODE_STARTS.reduce((acc, code) => acc.split(code).join(' '), rawTerminalText)
  for (const match of text.matchAll(LOCAL_PAGE)) {
    const path = (match[2] ?? '').replace(/[.,;:!?]+$/u, '')
    if (path.length <= 1) {
      continue
    }
    const url = `http://localhost:${match[1]}${path}`
    const prev = pages[match[1]]
    pages[match[1]] = prev && prev.startsWith(url) ? prev : url
  }
  return pages
}
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
  const knownPages = stored.pages?.[tabId] ?? {}
  const pages = { ...knownPages }
  for (const [port, url] of Object.entries(pagesByPort(rawTerminalText))) {
    // A later read that only caught a wrap-cut copy keeps the longer address already saved.
    if (!pages[port]?.startsWith(url)) {
      pages[port] = url
    }
  }
  const pagesChanged = Object.keys(pages).some((port) => pages[port] !== knownPages[port])
  const knownImages = stored.images?.[tabId] ?? []
  const freshImages = [...new Set(imagePathsIn(rawTerminalText))].filter(
    (path) => !knownImages.includes(path)
  )
  if (fresh.length > 0 || freshPorts.length > 0 || pagesChanged || freshImages.length > 0) {
    save({
      ...stored,
      links: { ...stored.links, [tabId]: [...known, ...fresh] },
      ports: { ...stored.ports, [tabId]: [...knownPorts, ...freshPorts] },
      pages: { ...stored.pages, [tabId]: pages },
      images: {
        ...stored.images,
        [tabId]: [...knownImages, ...freshImages].slice(-MAX_IMAGES_PER_CHAT)
      }
    })
  }
}

/** Image file paths in a chat's terminal text; a temp path with a URL scheme before it is a link, not a file. */
export function imagePathsIn(rawTerminalText: string): string[] {
  const text = ESCAPE_CODE_STARTS.reduce((acc, code) => acc.split(code).join(' '), rawTerminalText)
  return [...text.matchAll(IMAGE_PATH)]
    .filter((match) => !/[A-Za-z0-9:/]$/u.test(text.slice(0, match.index)))
    .map((match) => match[0])
}

export function imagesForTab(links: CanvasArtifactLinks, tabId: string): readonly string[] {
  return (links.images?.[tabId] ?? EMPTY).filter((path) => !links.dismissed.includes(path))
}

export function portsMentionedByTab(links: CanvasArtifactLinks, tabId: string): readonly number[] {
  return links.ports?.[tabId] ?? []
}

/** The page this chat showed for a port, if it showed one with a path. */
export function pageForPort(
  links: CanvasArtifactLinks,
  tabId: string,
  port: number
): string | undefined {
  return links.pages?.[tabId]?.[String(port)]
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

/** Links saved before whole-id matching may be cut-off copies of one link: keep only whole ids, once each. */
function wholeArtifactLinks(urls: readonly string[]): string[] {
  const whole = [...new Set(urls.filter((url) => WHOLE_ARTIFACT_LINK.test(url)))]
  // A wrap one character before the id ends still looks whole: the longer copy wins.
  return whole.filter((url) => !whole.some((other) => other !== url && other.startsWith(url)))
}

export function artifactLinksForTab(links: CanvasArtifactLinks, tabId: string): readonly string[] {
  const urls = links.links[tabId] ?? EMPTY
  return wholeArtifactLinks(urls).filter((url) => !links.dismissed.includes(url))
}
