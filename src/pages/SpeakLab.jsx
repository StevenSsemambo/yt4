import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { analyzeAttempt, getOfflineResponse } from '../ai/fluxEngine'
import { speakFlux, speak, stopSpeaking, ttsAvailable } from '../ai/voiceEngine'
import useFluxVoice from '../hooks/useFluxVoice'
import Flux from '../components/flux/Flux'

const EXERCISES = [
  {
    id: 'easy_onset', title: 'Easy Onset', icon: '🌅',
    color: 'from-cyan-500/20 to-cyan-500/20 border-cyan-500/30',
    instructions: 'Start each word gently, like a feather landing on water. Begin with a soft breath before the first sound.',
    prompts: [
      'Say slowly: "Hello... how... are... you..."',
      'Gentle start: "My name is... and I enjoy..."',
      'Soft opening: "Today... I want... to tell you..."',
      'Easy onset: "The sky is... beautiful and blue..."',
      'Flow: "I enjoy... speaking slowly... and gently..."',
    ],
    tips: 'Start every word with a soft breath, not a hard push.',
  },
  {
    id: 'continuous_phonation', title: 'Continuous Phonation', icon: '〰️',
    color: 'from-bloom-500/20 to-indigo-500/20 border-bloom-500/30',
    instructions: 'Keep your voice flowing like a river — no harsh stops between words. Connect sounds smoothly.',
    prompts: [
      'Connect: "Theeeee suuuun is waaarm toooodaay..."',
      'Flow: "I aaaam goooing toooo the stoooore..."',
      'Smooth: "Eveeery woooord flows iiiinto the next..."',
      'River: "Myyy voice flows like waaater..."',
      'Wave: "Sooooft and steady, alwaays moving..."',
    ],
    tips: 'Imagine your voice is a thread — never let it break.',
  },
  {
    id: 'rate_control', title: 'Rate Control', icon: '🎯',
    color: 'from-brave-500/20 to-orange-500/20 border-brave-500/30',
    instructions: 'Speak at half your normal speed. Use the rhythm guide. Each beat marks where you pause.',
    prompts: [
      '(Slow) "I — am — speaking — very — slowly..."',
      '(Pace) "One — word — at — a — time..."',
      '(Control) "The — slower — I — speak — the — better..."',
      '(Rhythm) "Each — pause — helps — my — brain — sync..."',
      '(Flow) "Slow — speech — feels — calm — and — brave..."',
    ],
    tips: "Slower speech gives your brain time to coordinate. It feels weird — that means it's working.",
  },
  {
    id: 'gentle_articulation', title: 'Gentle Articulation', icon: '🌿',
    color: 'from-spark-500/20 to-green-500/20 border-spark-500/30',
    instructions: 'Form each sound gently and precisely. Avoid tension in your jaw, lips, and tongue.',
    prompts: [
      'Relax jaw: "Mama made me mash my M and Ms..."',
      'Soft lips: "Peter Piper picked a peck of peppers..."',
      'Easy tongue: "Red lorry, yellow lorry, red lorry..."',
      'Loose jaw: "The big black bear sat by the brook..."',
      'Free face: "She sells seashells by the seashore..."',
    ],
    tips: 'Drop your jaw slightly. Tense muscles make stuttering worse.',
  },
]

const BEAT_INTERVAL = 800

export default function SpeakLab() {
  const [stage, setStage] = useState('menu')
  const [currentEx, setCurrentEx] = useState(null)
  const [promptIdx, setPromptIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [beat, setBeat] = useState(false)
  const [waveform, setWaveform] = useState(Array(32).fill(4))
  const [fluxFeedback, setFluxFeedback] = useState('')
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [completed, setCompleted] = useState([])
  const [micError, setMicError] = useState(false)
  const [readingPrompt, setReadingPrompt] = useState(false)

  const mediaRecRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const animRef = useRef(null)
  const beatRef = useRef(null)
  const navigate = useNavigate()
  const { triggerFlux, refreshProfile, profile } = useApp()
  const { fluxSay, fluxStop, fluxSpeaking } = useFluxVoice()

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 64
      const src = audioCtxRef.current.createMediaStreamSource(stream)
      src.connect(analyserRef.current)
      mediaRecRef.current = stream
      const update = () => {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const bars = Array.from({ length: 32 }, (_, i) => {
          const v = data[Math.floor(i * data.length / 32)] || 0
          return Math.max(4, (v / 255) * 60)
        })
        setWaveform(bars)
        animRef.current = requestAnimationFrame(update)
      }
      update()
      setMicError(false)
    } catch { setMicError(true) }
  }

  const stopMic = () => {
    cancelAnimationFrame(animRef.current)
    mediaRecRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    setWaveform(Array(32).fill(4))
  }

  const startBeat = () => {
    beatRef.current = setInterval(() => setBeat(b => !b), BEAT_INTERVAL)
  }

  const stopBeat = () => { clearInterval(beatRef.current); setBeat(false) }

  const readPromptAloud = async (text) => {
    setReadingPrompt(true)
    fluxStop()
    await speak(text, {
      ageGroup: profile?.ageGroup || 'explorer',
      rate: 0.7,
      onEnd: () => setReadingPrompt(false),
    })
    setReadingPrompt(false)
  }

  const startExercise = async (ex) => {
    setCurrentEx(ex)
    setPromptIdx(0)
    setStage('exercise')
    setCompleted(c => c.filter(id => id !== ex.id))
    await startMic()
    startBeat()
    const msg = `Let us begin ${ex.title}. ${ex.instructions}`
    fluxSay(msg, true)
    setFluxFeedback(ex.instructions)
  }

  const handleNext = async () => {
    if (promptIdx < currentEx.prompts.length - 1) {
      const next = promptIdx + 1
      setPromptIdx(next)
      fluxSay(getOfflineResponse('encouragement'), true)
      setFluxFeedback(getOfflineResponse('encouragement'))
    } else {
      setLoadingFeedback(true)
      stopBeat()
      try {
        const feedback = await analyzeAttempt(
          `Completed ${currentEx.title} with ${currentEx.prompts.length} prompts. Exercise: ${currentEx.instructions}`,
          currentEx.title,
          profile
        )
        setFluxFeedback(feedback)
        fluxSay(feedback, true)
      } catch {
        const msg = getOfflineResponse('celebration')
        setFluxFeedback(msg)
        fluxSay(msg, true)
      }
      setLoadingFeedback(false)
      setCompleted(c => [...c, currentEx.id])
      stopMic()
      if (completed.length + 1 >= EXERCISES.length) {
        await finishAll()
      } else {
        setStage('menu')
      }
    }
  }

  const finishAll = async () => {
    await addSession('speaklab', 50, { exercises: EXERCISES.length, duration: 300 })
    await markTodayStreak()
    await refreshProfile()
    const msg = getOfflineResponse('celebration')
    fluxSay(msg, true)
    setStage('done')
  }

  useEffect(() => () => { stopMic(); stopBeat(); fluxStop() }, [])

  return (
    <div className="min-h-full pb-24 page-enter">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => { stopMic(); stopBeat(); fluxStop(); navigate(-1) }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white flex-1">SpeakLab</h1>
        <span className="text-2xl">🗣️</span>
      </div>

      {stage === 'menu' && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-6">
            <Flux size={80} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating
              speaking={fluxSpeaking}
              showMessage
              message="Choose an exercise. Even 5 minutes rewires your brain! 🧠" />
          </div>
          <div className="space-y-3">
            {EXERCISES.map(ex => (
              <button key={ex.id} onClick={() => startExercise(ex)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-r ${ex.color} text-left active:scale-[0.98] transition-transform`}>
                <div className="text-3xl">{ex.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-white">{ex.title}</span>
                    {completed.includes(ex.id) && <span className="text-jade text-xs">✓ Done</span>}
                  </div>
                  <div className="text-white/50 text-sm">{ex.instructions.slice(0, 52)}…</div>
                </div>
                <div className="text-white/30">→</div>
              </button>
            ))}
          </div>
          {completed.length > 0 && (
            <button onClick={finishAll} className="btn-aqua w-full mt-4">
              Finish Session ({completed.length}/{EXERCISES.length}) ✓
            </button>
          )}
        </div>
      )}

      {stage === 'exercise' && currentEx && (
        <div className="px-5 flex flex-col gap-4">
          <div className="flex gap-1.5">
            {currentEx.prompts.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300
                ${i < promptIdx ? 'bg-jade' : i === promptIdx ? 'bg-cyan-400' : 'bg-white/15'}`} />
            ))}
          </div>

          <div className="flex justify-center">
            <Flux size={70} ageGroup={profile?.ageGroup || 'explorer'}
              mood={recording ? 'excited' : 'happy'}
              speaking={recording || fluxSpeaking} floating />
          </div>

          <div className={`p-4 rounded-2xl border bg-gradient-to-r ${currentEx.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{currentEx.icon}</span>
              <span className="font-display font-bold text-white">{currentEx.title}</span>
              <span className="text-white/40 text-xs ml-auto">{promptIdx + 1}/{currentEx.prompts.length}</span>
            </div>
            <p className="text-white/80 text-sm">{currentEx.instructions}</p>
          </div>

          {/* Rhythm beat */}
          <div className="flex gap-2 items-center justify-center py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-200
                ${beat && i % 2 === 0 ? 'bg-cyan-400 w-3 h-5' : 'bg-white/20 w-2 h-3'}`} />
            ))}
          </div>

          {/* Prompt card */}
          <div className="card text-center py-5 relative">
            <p className="font-display text-lg text-white leading-relaxed">{currentEx.prompts[promptIdx]}</p>
            {ttsAvailable() && (
              <button
                onClick={() => readPromptAloud(currentEx.prompts[promptIdx])}
                className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center
                  text-sm transition-all active:scale-90 ${readingPrompt
                    ? 'bg-cyan-400 text-white animate-pulse'
                    : 'bg-white/10 text-white/40 hover:text-white/70'}`}>
                {readingPrompt ? '⏹' : '🔊'}
              </button>
            )}
          </div>

          {/* Waveform */}
          <div className="flex items-end justify-center gap-0.5 h-12">
            {waveform.map((h, i) => (
              <div key={i} className="waveform-bar w-1.5"
                style={{ height: `${recording ? h : 4}px`, opacity: recording ? 1 : 0.3 }} />
            ))}
          </div>

          {micError && <p className="text-red-400 text-xs text-center">Mic not available — practice speaking aloud anyway! 🎙️</p>}

          {/* Flux feedback */}
          {fluxFeedback && (
            <div className="flex gap-3 items-start">
              <Flux size={32} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" speaking={fluxSpeaking} />
              <div className="glass rounded-2xl px-3 py-2 text-sm text-white/80 flex-1">
                {loadingFeedback ? '…' : fluxFeedback}
              </div>
              {ttsAvailable() && fluxFeedback && !loadingFeedback && (
                <button onClick={() => fluxSay(fluxFeedback, true)}
                  className="w-7 h-7 rounded-full bg-white/10 text-white/40 flex items-center justify-center text-xs hover:bg-white/20">
                  🔊
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onPointerDown={() => setRecording(true)}
              onPointerUp={() => setRecording(false)}
              onPointerLeave={() => setRecording(false)}
              className={`flex-1 py-4 rounded-2xl font-display font-bold transition-all duration-150 active:scale-95
                ${recording ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 text-white/70'}`}>
              {recording ? '🎙️ Recording…' : '🎙️ Hold to Speak'}
            </button>
            <button onClick={handleNext} className="btn-aqua px-6">
              {promptIdx < currentEx.prompts.length - 1 ? 'Next →' : 'Done ✓'}
            </button>
          </div>

          <div className="text-center text-white/30 text-xs">💡 {currentEx.tips}</div>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex flex-col items-center px-5 py-8 gap-6 text-center">
          <Flux size={120} ageGroup={profile?.ageGroup || 'explorer'} mood="excited" floating speaking={fluxSpeaking} />
          <div>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">SpeakLab Complete!</h2>
            <p className="text-white/60">You completed all {EXERCISES.length} exercises. Your brain just rewired itself a little. +50 Brave Stars!</p>
          </div>
          <button onClick={() => navigate('/home')} className="btn-aqua w-full">Back to Home</button>
        </div>
      )}
    </div>
  )
}
