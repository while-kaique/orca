import type React from 'react'
import { CANVAS_CONTEXT_LIMIT_TOKENS } from '../../../../shared/canvas-context-tokens'
import { translate } from '@/i18n/i18n'
import { useCanvasContextTokens } from './canvas-chat-context-tokens'

const WARN_AT = 0.5
const FULL_AT = 0.8

function contextLabel(tokens: number): string {
  return tokens >= 999_500
    ? `${(tokens / 1_000_000).toFixed(1).replace('.', ',')}M`
    : `${Math.round(tokens / 1000)}k`
}

/** How full the chat's context is, 0 to 1M tokens: green, then yellow, then red. */
export function CanvasChatContextMeter({
  transcriptPath
}: {
  transcriptPath: string | null
}): React.JSX.Element | null {
  const tokens = useCanvasContextTokens(transcriptPath)
  if (tokens === null) {
    return null
  }
  const share = Math.min(1, tokens / CANVAS_CONTEXT_LIMIT_TOKENS)
  const level = share >= FULL_AT ? 'full' : share >= WARN_AT ? 'warn' : 'ok'
  const label = contextLabel(tokens)
  return (
    <span
      className="cc-context"
      data-level={level}
      title={translate('fork.canvas.contextUsed', '{{used}} de 1M tokens de contexto', {
        used: label
      })}
    >
      <span className="cc-context-track">
        <span className="cc-context-fill" style={{ width: `${Math.max(2, share * 100)}%` }} />
      </span>
      <span className="cc-context-label">{label}</span>
    </span>
  )
}
