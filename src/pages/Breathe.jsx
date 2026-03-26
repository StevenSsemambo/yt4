import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse } from '../ai/fluxEngine'
import useFluxVoice from '../hooks/useFluxVoice'
import Flux from '../components/flux/Flux'

const EXERCISES = [
  { id: 'boat', label: 'Sail the Boat', icon: '⛵', desc: 'Breathe out to push the boat across the water', color: 'from-cyan-500 to-cyan-400' },
  { id: 'balloon', label: 'Float the Balloon', icon: '🎈', desc: 'Keep your breath steady to keep the balloon up', color: 'from-bloom-500 to-pink-400' },
  { id: 'feather', label: 'Float the Feather', icon: '🪶', desc: 'Gentle, steady breath to lift the feather', color: 'from-spark-500 to-lime-400' },
  { id: 'waveform', label: 'Waveform Breath', icon: '〰️', desc: 'Watch your breath create waves', color: 'from-brave-500 to-yellow-400' },
]

const PHASES = [
  { label: 'Breathe In', duration: 4000, scale: 1.4, color: '#38bdf8', instruction: 'Slow breath in through your nose...' },
  { label: 'Hold', duration: 2000, scale: 1.4, color: '#a78bfa', instruction: 'Hold gently...' },
  { label: 'Breathe Out', duration: 6000, scale: 1.0, color: '#10b981', instruction: 'Slow breath out through your mouth...' },
  { label: 'Rest', duration: 1000, scale: 1.0, color: '#64748b', instruction: 'Rest...' },
]

export default function Breathe() {
  const [selectedEx, setSelectedEx] = useState(null)
  const [running, setRunning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [cycles, setCycles] = useState(0)
  const [progress, setProgress] = useState(0)
  const [fluxMsg, setFluxMsg] = useState(getOfflineResponse('breathing'))
  const [done, setDone] = useState(false)
  const [micLevel, setMicLevel] = useState(0)

  const timerRef = useRef(null)
  const progressRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const micRef = useRef(null)
  const navigate = useNavigate()
  const { fluxSay, fluxStop, fluxSpeaking } = useFluxVoice()
  const { triggerFlux, refreshProfile } = useApp()
  const TARGET_CYCLES = 5

  // Mic setup
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      const source = audioCtxRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      micRef.current = stream

      const detectLevel = () => {
        if (!analyserRef.current) return
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setMicLevel(Math.min(avg / 30, 1))
        requestAnimationFrame(detectLevel)
      }
      detectLevel()
    } catch { /* mic not available */ }
  }, [])

  const stopMic = useCallback(() => {
    micRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    analyserRef.current = null
  }, [])

  // Breathing cycle
  useEffect(() => {
    if (!running) return
    const phase = PHASES[phaseIdx]
    let elapsed = 0
    const interval = 50

    progressRef.current = setInterval(() => {
      elapsed += interval
      setProgress(elapsed / phase.duration)
      if (elapsed >= phase.duration) {
        clearInterval(progressRef.current)
        const next = (phaseIdx + 1) % PHASES.length
        setPhaseIdx(next)
        if (next === 0) {
          const newCycles = cycles + 1
          setCycles(newCycles)
          if (newCycles >= TARGET_CYCLES) {
            finishSession()
          }
        }
      }
    }, interval)

    return () => clearInterval(progressRef.current)
  }, [running, phaseIdx, cycles])

  const finishSession = async () => {
    setRunning(false)
    setDone(true)
    stopMic()
    await addSession('breathe', 30, { duration: 180, cycles: TARGET_CYCLES })
    await markTodayStreak()
    await refreshProfile()
    triggerFlux(getOfflineResponse('celebration'))
  }

  const startExercise = async (ex) => {
    setSelectedEx(ex)
    setRunning(true)
    setCycles(0)
    setPhaseIdx(0)
    setProgress(0)
    setDone(false)
    const bMsg = getOfflineResponse('breathing'); setFluxMsg(bMsg); fluxSay(bMsg, true)
    await startMic()
  }

  const reset = () => {
    setRunning(false)
    setSelectedEx(null)
    setCycles(0)
    setPhaseIdx(0)
    setProgress(0)
    setDone(false)
    stopMic()
  }

  const phase = PHASES[phaseIdx]
  const circleSize = 200
  const circleScale = running ? (phaseIdx === 0 ? 1 + progress * 0.4 : phaseIdx === 2 ? 1.4 - progress * 0.4 : PHASES[phaseIdx].scale) : 1

  return (
    <div className="min-h-full pb-24 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => { reset(); navigate(-1) }} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white flex-1">Breathe & Flow</h1>
        <span className="text-2xl">💨</span>
      </div>

      {/* Exercise Selection */}
      {!selectedEx && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-8">
            <Flux size={90} ageGroup="explorer" mood="calm" floating showMessage message={fluxMsg} />
          </div>
          <h2 className="font-display font-semibold text-white/70 text-sm mb-3 uppercase tracking-wider">Choose your game</h2>
          <div className="space-y-3">
            {EXERCISES.map(ex => (
              <button
                key={ex.id}
                onClick={() => startExercise(ex)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${ex.color} bg-opacity-20 border border-white/10
                           active:scale-[0.98] transition-transform text-left`}
              >
                <div className="text-3xl">{ex.icon}</div>
                <div>
                  <div className="font-display font-bold text-white">{ex.label}</div>
                  <div className="text-white/60 text-sm">{ex.desc}</div>
                </div>
                <div className="ml-auto text-white/40">→</div>
              </button>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-aqua text-sm text-center">💡 <strong>Deep breathing</strong> turns down your brain's alarm system and reduces vocal muscle tension before speaking.</p>
          </div>
        </div>
      )}

      {/* Active Exercise */}
      {selectedEx && !done && (
        <div className="flex flex-col items-center px-5 py-4">
          <div className="text-white/50 text-sm mb-2">{selectedEx.icon} {selectedEx.label}</div>

          {/* Cycles */}
          <div className="flex gap-2 mb-8">
            {Array.from({ length: TARGET_CYCLES }).map((_, i) => (
              <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i < cycles ? 'bg-cyan-400 w-6' : 'bg-white/20 w-3'}`} />
            ))}
          </div>

          {/* Breathing Circle */}
          <div className="relative flex items-center justify-center mb-8" style={{ width: circleSize + 60, height: circleSize + 60 }}>
            {/* Outer glow rings */}
            {[1.2, 1.4, 1.6].map((r, i) => (
              <div
                key={i}
                className="absolute rounded-full border transition-all duration-[4000ms]"
                style={{
                  width: circleSize * circleScale * r,
                  height: circleSize * circleScale * r,
                  borderColor: phase?.color || '#38bdf8',
                  opacity: (0.15 - i * 0.04) * (micLevel > 0.1 ? 1.5 : 1),
                  transition: 'all 4s ease-in-out'
                }}
              />
            ))}

            {/* Main circle */}
            <div
              className="rounded-full flex items-center justify-center transition-all duration-[4000ms] ease-in-out"
              style={{
                width: circleSize * circleScale,
                height: circleSize * circleScale,
                background: `radial-gradient(circle, ${phase?.color || '#38bdf8'}30, ${phase?.color || '#38bdf8'}10)`,
                border: `3px solid ${phase?.color || '#38bdf8'}`,
                boxShadow: `0 0 40px ${phase?.color || '#38bdf8'}40`
              }}
            >
              <div className="text-center">
                <div className="font-display text-3xl font-bold" style={{ color: phase?.color || '#38bdf8' }}>
                  {phase?.label}
                </div>
                {micLevel > 0.05 && <div className="text-white/60 text-xs mt-1">Breathing detected ✓</div>}
              </div>
            </div>
          </div>

          {/* Instruction */}
          <div className="text-center mb-8">
            <p className="text-white/70 text-lg">{phase?.instruction}</p>
            <p className="text-white/30 text-sm mt-1">Cycle {cycles + 1} of {TARGET_CYCLES}</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-xs progress-bar mb-6">
            <div
              className="progress-fill transition-all duration-100"
              style={{ width: `${((cycles + progress) / TARGET_CYCLES) * 100}%`, background: `linear-gradient(90deg, ${phase?.color}, ${phase?.color}80)` }}
            />
          </div>

          <button onClick={reset} className="btn-ghost text-sm py-2 px-4">Stop Exercise</button>
        </div>
      )}

      {/* Done State */}
      {done && (
        <div className="flex flex-col items-center px-5 py-8 gap-6 text-center">
          <Flux size={120} ageGroup="explorer" mood="excited" floating />
          <div>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Amazing breathing!</h2>
            <p className="text-white/60">You completed {TARGET_CYCLES} breathing cycles. Your vocal muscles are relaxed and ready. +30 Brave Stars!</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => startExercise(selectedEx)} className="btn-ghost flex-1">Go Again</button>
            <button onClick={() => { reset(); navigate('/home') }} className="btn-aqua flex-1">Back Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
