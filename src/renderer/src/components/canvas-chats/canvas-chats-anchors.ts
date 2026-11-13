import { useSyncExternalStore } from 'react'
import { packItemOf, placePlan } from './canvas-chats-arrangement'
import {
  chatForest,
  isFreeChat,
  PACK_RULES,
  planBlocks,
  type BlockPlan,
  type CanvasBox,
  type CanvasProject,
  type ChatTree
} from './canvas-chats-layout'
import {
  bestSpot,
  nudgeAway,
  shiftRects,
  touches,
  type PackScreen,
  type Placed
} from './canvas-chats-packing'
import { effectiveOffset, type CanvasOffsets, type CanvasZone } from './canvas-chats-offsets'

/**
 * Fork: where each project card sits (its anchor). The chats of a project are laid out from its anchor, so what is drawn
 * around a project never depends on the other projects. "Reorganizar" writes the anchors; dragging a project moves its anchor.
 * `sig` is the outline the project had when the anchor was last settled: a different outline means the project grew or shrank.
 */
export type CanvasAnchor = { x: number; y: number; sig?: string }
export type CanvasAnchors = Readonly<Record<string, CanvasAnchor>>

const STORAGE_KEY = 'orca-fork.canvas-anchors'
const listeners = new Set<() => void>()
/** null = nothing saved yet: the flowchart still draws the previous rule's places until it converts them. */
let anchors: CanvasAnchors | null = readStored()

function readStored(): CanvasAnchors | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CanvasAnchors) : null
  } catch {
    return null
  }
}

export function saveCanvasAnchors(next: CanvasAnchors | null): void {
  anchors = next
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Storage blocked: anchors still hold for this session.
  }
  listeners.forEach((listener) => listener())
}

export function readCanvasAnchors(): CanvasAnchors | null {
  return anchors
}

export function useCanvasAnchors(): CanvasAnchors | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => anchors
  )
}

/** Dragging a project: its anchor moves by the distance dragged from where it was. */
export function moveCanvasAnchor(
  id: string,
  start: CanvasAnchor | undefined,
  dx: number,
  dy: number
): void {
  if (start && anchors) {
    saveCanvasAnchors({ ...anchors, [id]: { ...start, x: start.x + dx, y: start.y + dy } })
  }
}

export const outlineSignature = (plan: BlockPlan): string =>
  plan.shape.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';')

/** The chat each chat hangs from inside its project's hierarchy (free chats and top chats have none). */
export function chatParents(projects: readonly CanvasProject[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  const walk = (node: ChatTree): void => {
    for (const child of node.children) {
      out.set(child.chat.key, node.chat.key)
      walk(child)
    }
  }
  for (const project of projects) {
    chatForest(project.chats.filter((chat) => !isFreeChat(chat))).forEach(walk)
  }
  return out
}

export const sameAnchors = (a: CanvasAnchors | null, b: CanvasAnchors): boolean => {
  if (!a) {
    return false
  }
  const keys = Object.keys(b)
  return (
    keys.length === Object.keys(a).length &&
    keys.every((k) => a[k] && a[k].x === b[k].x && a[k].y === b[k].y && a[k].sig === b[k].sig)
  )
}

type Resolved = { boxes: Record<string, CanvasBox>; anchors: Record<string, CanvasAnchor> }

/**
 * Every project laid out from its anchor. A project with no anchor goes where it fits among the others. When projects grew or
 * shrank (`changed`) and a project beside them now touches, the one that did not change moves down or right, the least that
 * frees it, on the column grid. The order of the projects never changes.
 */
export function anchoredPlacement(
  projects: readonly CanvasProject[],
  saved: CanvasAnchors,
  changed: ReadonlySet<string>,
  screen: PackScreen
): Resolved {
  const plans = planBlocks(projects)
  const spot = new Map<string, { x: number; y: number }>()
  const items = new Map(plans.map((plan) => [plan.block.project.id, packItemOf(plan)]))
  const planOf = new Map(plans.map((plan) => [plan.block.project.id, plan]))
  const originOf = (id: string, header: { x: number; y: number }): { x: number; y: number } => {
    const plan = planOf.get(id) as BlockPlan
    return { x: header.x - plan.header.x, y: header.y - plan.header.y }
  }
  const rectsOf = (id: string): CanvasBox[] => {
    const origin = spot.get(id) as { x: number; y: number }
    return shiftRects(items.get(id)?.rects ?? [], origin.x, origin.y)
  }
  const known = plans.filter((plan) => saved[plan.block.project.id])
  for (const plan of known) {
    const id = plan.block.project.id
    spot.set(id, originOf(id, saved[id]))
  }
  const othersRects = (except: string): CanvasBox[] =>
    [...spot.keys()].filter((id) => id !== except).flatMap(rectsOf)
  if (changed.size > 0) {
    const triggers = new Set([...changed].filter((id) => spot.has(id)))
    for (const plan of known) {
      const id = plan.block.project.id
      if (triggers.has(id)) {
        continue
      }
      const origin = spot.get(id) as { x: number; y: number }
      const hit = [...triggers].flatMap((t) => (t === id ? [] : rectsOf(t)))
      const item = items.get(id) as NonNullable<ReturnType<typeof items.get>>
      if (touches(item, origin.x, origin.y, hit, PACK_RULES)) {
        spot.set(id, nudgeAway(item, origin, othersRects(id), PACK_RULES))
        triggers.add(id)
      }
    }
  }
  const placed = (): Placed[] =>
    [...spot.entries()].map(([id, origin]) => ({
      item: items.get(id) as NonNullable<ReturnType<typeof items.get>>,
      x: origin.x,
      y: origin.y,
      rects: rectsOf(id)
    }))
  for (const plan of plans) {
    const id = plan.block.project.id
    if (!spot.has(id)) {
      const base = placed()
      spot.set(
        id,
        base.length
          ? bestSpot(
              items.get(id) as NonNullable<ReturnType<typeof items.get>>,
              base,
              screen,
              PACK_RULES
            )
          : { x: 0, y: 0 }
      )
    }
  }
  const boxes: Record<string, CanvasBox> = {}
  const out: Record<string, CanvasAnchor> = {}
  for (const plan of plans) {
    const id = plan.block.project.id
    const origin = spot.get(id) as { x: number; y: number }
    const header = { x: origin.x + plan.header.x, y: origin.y + plan.header.y }
    out[id] = { ...header, sig: saved[id]?.sig }
    Object.assign(boxes, placePlan(plan, header))
  }
  return { boxes, anchors: out }
}

/**
 * First time with anchors: every card stays exactly where the previous rule had put it (its automatic spot plus what the user
 * dragged). The project card becomes the anchor; each chat keeps the distance between its place under the anchor and where it is.
 */
export function convertLegacyPlacement(
  projects: readonly CanvasProject[],
  legacyBoxes: Readonly<Record<string, CanvasBox>>,
  stored: CanvasOffsets,
  zones: ReadonlyMap<string, CanvasZone>
): { anchors: Record<string, CanvasAnchor>; offsets: CanvasOffsets } {
  const out: Record<string, CanvasAnchor> = {}
  const offsets: Record<string, { dx: number; dy: number; zone?: CanvasZone }> = {}
  const shown = (key: string): CanvasBox | undefined => {
    const box = legacyBoxes[key]
    const offset = effectiveOffset(key, stored, zones)
    return box && { ...box, x: box.x + (offset?.dx ?? 0), y: box.y + (offset?.dy ?? 0) }
  }
  for (const plan of planBlocks(projects)) {
    const id = plan.block.project.id
    const header = shown(`project:${id}`)
    if (!header) {
      continue
    }
    out[id] = { x: header.x, y: header.y, sig: outlineSignature(plan) }
    const auto = placePlan(plan, header)
    for (const chat of plan.block.project.chats) {
      const at = shown(chat.key)
      if (at) {
        const zone = stored[chat.key]?.zone
        offsets[chat.key] = {
          dx: at.x - auto[chat.key].x,
          dy: at.y - auto[chat.key].y,
          ...(zone ? { zone } : {})
        }
      }
    }
  }
  return { anchors: out, offsets }
}

export type { CanvasZone }
