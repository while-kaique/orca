import React from 'react'

/** Bolds the characters the search matched. */
export function HighlightedName({
  name,
  indexes
}: {
  name: string
  indexes: readonly number[]
}): React.JSX.Element {
  if (indexes.length === 0) {
    return <>{name}</>
  }
  const hits = new Set(indexes)
  const parts: { text: string; hit: boolean }[] = []
  for (const [i, char] of [...name].entries()) {
    const hit = hits.has(i)
    const last = parts.at(-1)
    if (last && last.hit === hit) {
      last.text += char
    } else {
      parts.push({ text: char, hit })
    }
  }
  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <span key={i} className="font-semibold text-foreground">
            {part.text}
          </span>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        )
      )}
    </>
  )
}

/** Marks a project or worktree that has chats open right now. */
export function OpenDot(): React.JSX.Element {
  return (
    <span
      aria-label="Com chat aberto"
      className="size-1.5 shrink-0 rounded-full bg-status-success"
    />
  )
}
