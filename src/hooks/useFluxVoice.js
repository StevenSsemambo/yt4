import { useCallback, useRef, useState } from 'react'
import { speakFlux, stopSpeaking, ttsAvailable } from '../ai/voiceEngine'
import { useApp } from './useAppContext'

/**
 * useFluxVoice — give any page the ability to have Flux speak.
 * Usage:
 *   const { fluxSay, fluxStop, fluxSpeaking } = useFluxVoice()
 *   fluxSay("You did great!")
 */
export default function useFluxVoice() {
  const { profile } = useApp()
  const [fluxSpeaking, setFluxSpeaking] = useState(false)
  const queueRef = useRef([])
  const playingRef = useRef(false)

  const ageGroup = profile?.ageGroup || 'explorer'

  const fluxStop = useCallback(() => {
    stopSpeaking()
    setFluxSpeaking(false)
    queueRef.current = []
    playingRef.current = false
  }, [])

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setFluxSpeaking(false)
      playingRef.current = false
      return
    }
    const text = queueRef.current.shift()
    setFluxSpeaking(true)
    playingRef.current = true
    speakFlux(text, ageGroup, {
      onEnd: () => playNext(),
    })
  }, [ageGroup])

  const fluxSay = useCallback((text, immediate = false) => {
    if (!ttsAvailable() || !text) return
    if (immediate) {
      fluxStop()
      queueRef.current = [text]
      playNext()
    } else {
      queueRef.current.push(text)
      if (!playingRef.current) playNext()
    }
  }, [playNext, fluxStop])

  return { fluxSay, fluxStop, fluxSpeaking, ttsOk: ttsAvailable() }
}
