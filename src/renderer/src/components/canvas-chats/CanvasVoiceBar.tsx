import { useEffect } from 'react'
import { Mic, MicOff, Loader2, Check } from 'lucide-react'
import { CANVAS_VOICE_SILENCE_MS, useCanvasVoicePrompt } from './use-canvas-voice-prompt'

// Fork: voice strip at the bottom of an open chat card; typing in the card hands control back to the keyboard.
export function CanvasVoiceBar({
  ptyId,
  cardRef,
  autoStart = true
}: {
  ptyId: string
  cardRef: React.RefObject<HTMLDivElement | null>
  autoStart?: boolean
}): React.JSX.Element {
  const { state, start, cancel } = useCanvasVoicePrompt(ptyId, autoStart)
  const active = state.kind === 'starting' || state.kind === 'listening'

  useEffect(() => {
    const card = cardRef.current
    if (!card || !active) {
      return
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') {
        cancel()
      }
    }
    card.addEventListener('keydown', onKey, true)
    return () => card.removeEventListener('keydown', onKey, true)
  }, [cardRef, active, cancel])

  let icon: React.JSX.Element
  let text: string
  switch (state.kind) {
    case 'starting':
      icon = <Loader2 size={13} className="cc-voice-spin" />
      text = 'Preparando o microfone…'
      break
    case 'listening':
      icon = <Mic size={13} />
      text =
        state.silenceLeftMs !== null
          ? `Envio em ${Math.max(1, Math.ceil(state.silenceLeftMs / 1000))} s… (fale para continuar)`
          : state.heard
            ? 'Ouvindo…'
            : `Pode falar. ${CANVAS_VOICE_SILENCE_MS / 1000} s de silêncio envia.`
      break
    case 'transcribing':
      icon = <Loader2 size={13} className="cc-voice-spin" />
      text = 'Escrevendo e enviando…'
      break
    case 'sent':
      icon = <Check size={13} />
      text = `Enviado: “${state.text}”`
      break
    case 'empty':
      icon = <MicOff size={13} />
      text = 'Não entendi nada. Clique no microfone para tentar de novo.'
      break
    case 'unavailable':
      icon = <MicOff size={13} />
      text = state.reason
      break
    default:
      icon = <MicOff size={13} />
      text = 'Microfone desligado. Digite no terminal ou clique para falar.'
  }

  const level = state.kind === 'listening' ? state.level : 0

  return (
    <div className="cc-voice" data-voice={state.kind} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="cc-voice-mic"
        title={active ? 'Parar de ouvir' : 'Falar'}
        onClick={() => (active ? cancel() : void start())}
        style={{ '--cc-voice-level': level } as React.CSSProperties}
      >
        {icon}
      </button>
      <span className="cc-voice-text" title={text}>
        {text}
      </span>
    </div>
  )
}
