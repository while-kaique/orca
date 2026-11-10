import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { useAudioCapture } from '@/hooks/use-audio-capture'
import { formatFinalTranscriptSegment } from '../../../../shared/dictation-transcript-spacing'
import type { DictationMeterState } from '../../../../shared/dictation-audio-meter'
import { terminalPreviewApiFor } from '../dashboard-popout/terminal-preview-api'

// Fork: opening a chat card listens to the mic; 3 s of silence after speech transcribes and submits to that chat.
export const CANVAS_VOICE_SILENCE_MS = 3000
const STOP_TIMEOUT_MS = 10_000
const SUBMIT_DELAY_MS = 250

export type CanvasVoiceState =
  | { kind: 'off' }
  | { kind: 'starting' }
  | { kind: 'listening'; heard: boolean; silenceLeftMs: number | null; level: number }
  | { kind: 'transcribing' }
  | { kind: 'sent'; text: string }
  | { kind: 'empty' }
  | { kind: 'unavailable'; reason: string }

let sessionCounter = 0

export function useCanvasVoicePrompt(ptyId: string | null, autoStart: boolean) {
  const settings = useAppStore((s) => s.settings)
  const globalDictation = useAppStore((s) => s.dictationState)
  const [state, setState] = useState<CanvasVoiceState>({ kind: 'off' })
  const meterRef = useRef<{ speaking: boolean; changedAt: number; heard: boolean; level: number }>({
    speaking: false,
    changedAt: 0,
    heard: false,
    level: 0
  })
  const sessionRef = useRef<string | null>(null)
  const transcriptRef = useRef('')
  const stoppedRef = useRef(new Map<string, () => void>())
  const finishingRef = useRef(false)

  const onMeter = useCallback((meter: DictationMeterState) => {
    const m = meterRef.current
    m.level = meter.level
    if (meter.isSpeaking !== m.speaking) {
      m.speaking = meter.isSpeaking
      m.changedAt = performance.now()
      if (meter.isSpeaking) {
        m.heard = true
      }
    }
  }, [])
  const capture = useAudioCapture(onMeter)
  const captureRef = useRef(capture)
  captureRef.current = capture

  const teardown = useCallback(async (sessionId: string): Promise<void> => {
    captureRef.current.stop()
    const stopped = new Promise<void>((resolve) => {
      stoppedRef.current.set(sessionId, resolve)
      setTimeout(resolve, STOP_TIMEOUT_MS)
    })
    await window.api.speech.stopDictation(sessionId).catch(() => undefined)
    await stopped
    stoppedRef.current.delete(sessionId)
  }, [])

  const cancel = useCallback(() => {
    const sessionId = sessionRef.current
    sessionRef.current = null
    finishingRef.current = false
    setState({ kind: 'off' })
    if (sessionId) {
      void teardown(sessionId)
    }
  }, [teardown])

  const submit = useCallback(
    async (text: string) => {
      if (!ptyId) {
        return
      }
      const api = terminalPreviewApiFor(ptyId)
      await api.input(ptyId, text.replace(/\s*\n\s*/g, ' '))
      // A separate Enter after a pause so agent TUIs treat it as submit, not as part of a paste.
      await new Promise((r) => setTimeout(r, SUBMIT_DELAY_MS))
      await api.input(ptyId, '\r')
    },
    [ptyId]
  )

  const finish = useCallback(async () => {
    const sessionId = sessionRef.current
    if (!sessionId || finishingRef.current) {
      return
    }
    finishingRef.current = true
    setState({ kind: 'transcribing' })
    await teardown(sessionId)
    if (sessionRef.current !== sessionId) {
      return
    }
    sessionRef.current = null
    finishingRef.current = false
    const text = transcriptRef.current.trim()
    if (!text) {
      // A cough or click is not a prompt: keep listening instead of dropping the mic.
      setState({ kind: 'empty' })
      void startRef.current()
      return
    }
    await submit(text)
    setState({ kind: 'sent', text })
  }, [submit, teardown])

  const start = useCallback(async () => {
    if (!ptyId || sessionRef.current) {
      return
    }
    const voice = settings?.voice
    if (!voice?.enabled || !voice.sttModel) {
      setState({ kind: 'unavailable', reason: 'Ative o ditado em Configurações → Voice.' })
      return
    }
    if (globalDictation !== 'idle') {
      setState({ kind: 'unavailable', reason: 'O ditado do Ctrl+E está em uso.' })
      return
    }
    sessionCounter += 1
    const sessionId = `canvas-${sessionCounter}`
    sessionRef.current = sessionId
    transcriptRef.current = ''
    finishingRef.current = false
    meterRef.current = { speaking: false, changedAt: performance.now(), heard: false, level: 0 }
    setState({ kind: 'starting' })
    try {
      await captureRef.current.start({
        bufferAudio: true,
        sessionId,
        microphoneDeviceId: voice.microphoneDeviceId ?? null,
        microphoneDeviceLabel: voice.microphoneDeviceLabel ?? null,
        onCaptureLost: () => {
          if (sessionRef.current === sessionId) {
            cancel()
          }
        }
      })
      if (sessionRef.current !== sessionId) {
        captureRef.current.stop()
        return
      }
      await window.api.speech.startDictation(voice.sttModel, undefined, sessionId)
      await captureRef.current.flushBufferedAudio()
      if (sessionRef.current !== sessionId) {
        await teardown(sessionId)
        return
      }
      setState({ kind: 'listening', heard: false, silenceLeftMs: null, level: 0 })
    } catch (err) {
      if (sessionRef.current === sessionId) {
        sessionRef.current = null
        captureRef.current.stop()
        void window.api.speech.stopDictation(sessionId).catch(() => undefined)
        setState({ kind: 'unavailable', reason: `Não consegui ouvir: ${String(err)}` })
      }
    }
  }, [ptyId, settings, globalDictation, cancel, teardown])

  const startRef = useRef(start)
  startRef.current = start

  useEffect(() => {
    const offFinal = window.api.speech.onFinalTranscript((data) => {
      if (data.sessionId !== sessionRef.current || !data.text) {
        return
      }
      transcriptRef.current += formatFinalTranscriptSegment(data.text, transcriptRef.current)
    })
    const offStopped = window.api.speech.onStopped((data) => {
      stoppedRef.current.get(data.sessionId)?.()
    })
    const offError = window.api.speech.onError((data) => {
      if (data.sessionId === sessionRef.current) {
        sessionRef.current = null
        captureRef.current.stop()
        setState({ kind: 'unavailable', reason: `Erro na voz: ${data.error}` })
      }
    })
    return () => {
      offFinal()
      offStopped()
      offError()
    }
  }, [])

  // Silence clock: after any speech, 3 s without speaking ends the prompt.
  useEffect(() => {
    if (state.kind !== 'listening') {
      return
    }
    const timer = setInterval(() => {
      const m = meterRef.current
      const silentFor = m.speaking ? 0 : performance.now() - m.changedAt
      if (m.heard && !m.speaking && silentFor >= CANVAS_VOICE_SILENCE_MS) {
        void finish()
        return
      }
      setState({
        kind: 'listening',
        heard: m.heard,
        silenceLeftMs: m.heard && !m.speaking ? CANVAS_VOICE_SILENCE_MS - silentFor : null,
        level: m.level
      })
    }, 100)
    return () => clearInterval(timer)
  }, [state.kind, finish])

  useEffect(() => {
    if (autoStart && ptyId) {
      void start()
    }
    return () => {
      if (sessionRef.current) {
        cancel()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, ptyId])

  return { state, start, cancel }
}
