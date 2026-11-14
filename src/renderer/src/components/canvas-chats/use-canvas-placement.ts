import { useEffect, useMemo } from 'react'
import {
  anchoredPlacement,
  chatParents,
  convertLegacyPlacement,
  outlineSignature,
  readCanvasAnchors,
  sameAnchors,
  saveCanvasAnchors,
  useCanvasAnchors,
  type CanvasAnchors
} from './canvas-chats-anchors'
import {
  DEFAULT_CANVAS_INSETS,
  layoutCanvas,
  packScreen,
  type CanvasInsets
} from './canvas-chats-arrangement'
import {
  canvasStructureKey,
  isFreeChat,
  planBlocks,
  type CanvasBox,
  type CanvasProject
} from './canvas-chats-layout'
import { legacyAutoBoxes } from './canvas-chats-layout-legacy'
import {
  applyCanvasOffsets,
  readCanvasOffsets,
  setAllCanvasOffsets,
  useCanvasOffsets,
  type CanvasZone
} from './canvas-chats-offsets'

/** A change in the hierarchy takes this long to be believed: right after opening, every chat looks free until it is read. */
const SETTLE_MS = 4000

const chatZones = (projects: readonly CanvasProject[]): Map<string, CanvasZone> =>
  new Map(
    projects.flatMap((project) =>
      project.chats.map((chat): [string, CanvasZone] => [
        chat.key,
        isFreeChat(chat) ? 'free' : 'tree'
      ])
    )
  )

/**
 * Where every card is drawn. Before anything is saved the previous rule's places are kept (`legacyAutoBoxes` plus the saved
 * drags) until `settle` or the first Reorganizar turns them into anchors without moving a single card. From then on each
 * project is laid out from its anchor, and a chat nobody dragged moves with the chat that created it.
 */
export function useCanvasPlacement(
  projects: readonly CanvasProject[],
  viewport: { w: number; h: number }
): {
  boxes: Record<string, CanvasBox>
  zones: ReadonlyMap<string, CanvasZone>
  anchored: boolean
  /** Turns the previous rule's places into anchors, once. */
  convertNow: () => void
  /** Reorganizar: the biggest arrangement, anchors written, drags cleared. Returns where every card went. */
  reorganize: (insets: CanvasInsets) => Record<string, CanvasBox>
} {
  const anchors = useCanvasAnchors()
  const offsets = useCanvasOffsets()
  const structureKey = canvasStructureKey(projects)
  const zones = useMemo(
    () => chatZones(projects),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey]
  )
  const parents = useMemo(
    () => chatParents(projects),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey]
  )
  const measured = viewport.w > 0
  const legacy = useMemo(
    () => (anchors ? null : legacyAutoBoxes(projects, viewport)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey, measured, anchors === null]
  )
  const outline = useMemo(
    () =>
      new Map(planBlocks(projects).map((plan) => [plan.block.project.id, outlineSignature(plan)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structureKey]
  )
  const placed = useMemo(() => {
    if (!anchors) {
      return null
    }
    const changed = new Set(
      [...outline]
        .filter(([id, sig]) => anchors[id]?.sig !== undefined && anchors[id].sig !== sig)
        .map(([id]) => id)
    )
    return anchoredPlacement(
      projects,
      anchors,
      changed,
      packScreen(viewport, DEFAULT_CANVAS_INSETS)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey, anchors, measured])
  const boxes = useMemo(
    () =>
      placed
        ? applyCanvasOffsets(placed.boxes, offsets, zones, { parents, skipProjects: true })
        : applyCanvasOffsets(legacy ?? {}, offsets, zones),
    [placed, legacy, offsets, zones, parents]
  )

  // What was worked out is only written once the chats stopped changing: a half-read hierarchy must not move any project for good.
  useEffect(() => {
    if (!placed || !measured || projects.length === 0) {
      return
    }
    const timer = window.setTimeout(() => {
      const next: Record<string, { x: number; y: number; sig?: string }> = {}
      for (const [id, anchor] of Object.entries(placed.anchors)) {
        next[id] = { x: anchor.x, y: anchor.y, sig: outline.get(id) }
      }
      if (!sameAnchors(readCanvasAnchors(), next)) {
        saveCanvasAnchors({ ...readCanvasAnchors(), ...next })
      }
    }, SETTLE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, measured, outline])

  const convertNow = (): void => {
    if (readCanvasAnchors() || !legacy || projects.length === 0) {
      return
    }
    const converted = convertLegacyPlacement(projects, legacy, readCanvasOffsets(), zones)
    setAllCanvasOffsets(converted.offsets)
    saveCanvasAnchors(converted.anchors as CanvasAnchors)
  }

  // Quiet for a while with nothing saved: the picture on screen is the real one, so it becomes the saved one.
  useEffect(() => {
    if (anchors || !measured || projects.length === 0) {
      return
    }
    const timer = window.setTimeout(convertNow, SETTLE_MS + 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey, measured, anchors === null])

  const reorganize = (insets: CanvasInsets): Record<string, CanvasBox> => {
    const next = layoutCanvas(projects, viewport, insets)
    const saved: Record<string, { x: number; y: number; sig?: string }> = {}
    for (const [id, header] of Object.entries(next.headers)) {
      saved[id] = { ...header, sig: outline.get(id) }
    }
    setAllCanvasOffsets({})
    saveCanvasAnchors(saved)
    return next.boxes
  }

  return { boxes, zones, anchored: anchors !== null, convertNow, reorganize }
}
