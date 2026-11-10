import { Fragment } from 'react'

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g

/** Light markdown for card text: **bold**, *italic*, `code`, headings and bullets — no raw asterisks on the card. */
export function renderCanvasMarkdown(text: string): React.ReactNode {
  return text.split('\n').map((rawLine, lineIndex) => {
    const heading = /^#{1,6}\s+/.test(rawLine)
    const line = rawLine.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '• ')
    const parts = line.split(INLINE).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return <code key={i}>{part.slice(1, -1)}</code>
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>
      }
      return <Fragment key={i}>{part}</Fragment>
    })
    return (
      <Fragment key={lineIndex}>
        {lineIndex > 0 ? '\n' : null}
        {heading ? <strong>{parts}</strong> : parts}
      </Fragment>
    )
  })
}
