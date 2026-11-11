export type CanvasChatModelLabel = { family: string; label: string }

/** 'claude-fable-5-2' reads as 'Fable 5.2' on the card; an id from another provider shows as it is. */
export function canvasChatModelLabel(model: string | null): CanvasChatModelLabel | null {
  const id = model?.trim()
  if (!id) {
    return null
  }
  const match =
    /(fable|mythos|opus|sonnet|haiku)(?:[-\s](\d{1,2}))?(?:[-.](\d{1,2})(?!\d))?/iu.exec(id)
  if (!match) {
    return { family: 'other', label: id }
  }
  const family = match[1].toLowerCase()
  const version = [match[2], match[3]].filter(Boolean).join('.')
  const name = `${family[0].toUpperCase()}${family.slice(1)}`
  return { family, label: version ? `${name} ${version}` : name }
}
