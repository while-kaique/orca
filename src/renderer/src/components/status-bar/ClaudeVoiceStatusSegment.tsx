import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ClaudeVoiceStatus } from '../../../../shared/claude-voice-status'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from './status-bar-context-menu-policy'

// Fork: mute/unmute the Claude read-aloud hook; mirrors the global Ctrl+Alt+V shortcut.
export function ClaudeVoiceStatusSegment({
  iconOnly
}: {
  iconOnly: boolean
}): React.JSX.Element | null {
  const [status, setStatus] = useState<ClaudeVoiceStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    const unsubscribe = window.api.claudeVoice.onChanged((next) => {
      if (mounted) {
        setStatus(next)
      }
    })
    void window.api.claudeVoice
      .getStatus()
      .then((next) => {
        if (mounted) {
          setStatus(next)
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  if (!status?.installed) {
    return null
  }

  const on = !status.muted
  const label = on ? 'Voz ligada' : 'Voz muda'
  const hint = on ? 'Clique para calar o Claude agora' : 'Clique para o Claude voltar a falar'

  const toggle = (): void => {
    if (busy) {
      return
    }
    setBusy(true)
    setStatus({ ...status, muted: on })
    void window.api.claudeVoice
      .toggle()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setBusy(false))
  }

  const Icon = on ? Volume2 : VolumeX

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          onClick={toggle}
          aria-pressed={on}
          aria-label={`Voz do Claude: ${label}`}
          className="inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
        >
          <Icon className={`size-3 ${on ? 'text-foreground' : ''}`} />
          {!iconOnly ? <span className="text-[11px] font-medium">{label}</span> : null}
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${on ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        Voz do Claude · {label}. {hint} (atalho: Ctrl+Alt+V em qualquer lugar).
      </TooltipContent>
    </Tooltip>
  )
}
