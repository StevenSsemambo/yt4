import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addJournalEntry, getJournalEntries, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const MOODS = [
  { id: 'great', label: 'Great', emoji: '😄', color: 'bg-jade/20 border-spark-400/30' },
  { id: 'okay', label: 'Okay', emoji: '😊', color: 'bg-cyan-400/20 border-cyan-400/30' },
  { id: 'meh', label: 'Meh', emoji: '😐', color: 'bg-white/10 border-white/20' },
  { id: 'hard', label: 'Hard', emoji: '😔', color: 'bg-bloom-400/20 border-bloom-400/30' },
]

const PROMPTS = [
  "How was your day?",
  "Tell me one brave thing you did today.",
  "What made you smile today?",
  "Describe your day in three words, then explain one.",
  "What's something you said today that you're proud of?",
  "If today was a weather, what was it?",
]

export default function Journal() {
  const [stage, setStage] = useState('menu') // menu | record | playback | done
  const [entries, setEntries] = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [prompt] = useState(PROMPTS[Math.floor(Math.random() * PROMPTS.length)])
  const [saving, setSaving] = useState(false)

  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const navigate = useNavigate()
  const { refreshProfile, triggerFlux, profile } = useApp()
  const { fluxSay } = useFluxVoice()

  useEffect(() => {
    const load = async () => {
      const e = await getJournalEntries()
      setEntries(e)
    }
    load()
  }, [])

  const startRecording = async () => {
    fluxSay(prompt, true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecRef.current = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRecRef.current.ondataavailable = e => chunksRef.current.push(e.data)
      mediaRecRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
        setStage('playback')
      }
      mediaRecRef.current.start()
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => {
        if (d >= 90) { stopRecording(); return d }
        return d + 1
      }), 1000)
    } catch {
      alert('Microphone not available. Please allow mic access to record.')
    }
  }

  const stopRecording = () => {
    mediaRecRef.current?.stop()
    clearInterval(timerRef.current)
    setRecording(false)
  }

  const saveEntry = async () => {
    if (!audioBlob) return
    setSaving(true)
    try {
      await addJournalEntry(audioBlob, duration, selectedMood?.id || 'okay')
      await markTodayStreak()
      await refreshProfile()
      triggerFlux(getOfflineResponse('celebration'))
      const e = await getJournalEntries()
      setEntries(e)
      setStage('done')
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  const discard = () => {
    setAudioUrl(null)
    setAudioBlob(null)
    setDuration(0)
    setStage('record')
  }

  const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="min-h-full pb-24 page-enter">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white flex-1">Voice Journal</h1>
        <span className="text-2xl">🎙️</span>
      </div>

      {/* Menu — past entries + record new */}
      {stage === 'menu' && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-6">
            <Flux size={80} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating
              showMessage message={getOfflineResponse('journal_prompts')} />
          </div>

          <button
            onClick={() => setStage('record')}
            className="w-full py-5 rounded-3xl bg-gradient-to-r from-spark-500 to-cyan-500 font-display font-bold text-xl text-white mb-6 active:scale-[0.98] transition-transform shadow-lg shadow-cyan-500/20"
          >
            🎙️ Record Today's Entry
          </button>

          {entries.length > 0 && (
            <>
              <h2 className="font-display font-semibold text-white/70 text-sm mb-3 uppercase tracking-wider">
                Your Journal ({entries.length} entries)
              </h2>
              <div className="space-y-3">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="card flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-bloom-500/20 flex items-center justify-center text-lg">
                      {MOODS.find(m => m.id === entry.mood)?.emoji || '😊'}
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-white text-sm">Entry #{entries.length - i}</div>
                      <div className="text-white/40 text-xs">{formatDate(entry.date)} · {formatDuration(entry.duration || 0)}</div>
                    </div>
                    {entry.blob && (
                      <audio src={URL.createObjectURL(entry.blob)} controls className="h-8 max-w-[120px]" />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {entries.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🎙️</div>
              <p className="text-white/40 text-sm">Your first voice journal entry will live here. Start with just 30 seconds!</p>
            </div>
          )}

          <div className="mt-6 p-4 rounded-2xl bg-spark-500/10 border border-spark-500/20">
            <p className="text-spark-300 text-sm">💡 <strong>Hearing your own voice improve</strong> over months is one of the most powerful confidence builders. Every entry is evidence of your bravery.</p>
          </div>
        </div>
      )}

      {/* Record Stage */}
      {stage === 'record' && (
        <div className="flex flex-col items-center px-5 py-6 gap-6">
          <Flux
            size={100}
            ageGroup={profile?.ageGroup || 'explorer'}
            mood={recording ? 'excited' : 'happy'}
            speaking={recording}
            floating
          />

          <div className="text-center">
            <p className="text-white/50 text-sm mb-2">Today's prompt:</p>
            <p className="font-display text-lg font-semibold text-white">"{prompt}"</p>
          </div>

          {/* Mood Selection */}
          <div className="w-full">
            <p className="text-white/40 text-xs text-center mb-3">How are you feeling?</p>
            <div className="flex gap-2 justify-center">
              {MOODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMood(m)}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                    selectedMood?.id === m.id ? m.color + ' scale-110' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-xs text-white/50 mt-0.5">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          {recording && (
            <div className="text-center">
              <div className="font-mono text-4xl font-bold text-aqua">{formatDuration(duration)}</div>
              <div className="text-white/30 text-xs mt-1">Max 90 seconds</div>
              <div className="progress-bar w-48 mt-2">
                <div className="progress-fill bg-cyan-400" style={{ width: `${(duration / 90) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Big Record Button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold transition-all duration-200 active:scale-95 ${
              recording
                ? 'bg-red-500 shadow-lg shadow-red-500/40 animate-pulse'
                : 'bg-gradient-to-br from-cyan-500 to-bloom-500 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
            }`}
          >
            {recording ? '⏹' : '🎙️'}
          </button>

          <p className="text-white/30 text-sm text-center">
            {recording ? 'Tap to stop when ready' : 'Tap to start recording'}
          </p>

          <button onClick={() => setStage('menu')} className="btn-ghost text-sm py-2 px-4">Cancel</button>
        </div>
      )}

      {/* Playback & Save */}
      {stage === 'playback' && audioUrl && (
        <div className="flex flex-col items-center px-5 py-6 gap-6">
          <Flux size={90} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating />
          <div className="text-center">
            <h2 className="font-display text-xl font-bold text-white mb-1">Great recording! 🎉</h2>
            <p className="text-white/50 text-sm">{formatDuration(duration)} · {selectedMood?.emoji} {selectedMood?.label}</p>
          </div>

          <div className="card w-full flex flex-col items-center gap-3 py-6">
            <audio src={audioUrl} controls className="w-full" />
            <p className="text-white/40 text-xs">Play it back — this is YOUR voice being brave</p>
          </div>

          <div className="flex gap-3 w-full">
            <button onClick={discard} className="btn-ghost flex-1">Redo</button>
            <button onClick={saveEntry} disabled={saving} className="btn-aqua flex-1">
              {saving ? 'Saving...' : 'Save Entry 💙'}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="flex flex-col items-center px-5 py-8 gap-6 text-center">
          <Flux size={120} ageGroup={profile?.ageGroup || 'explorer'} mood="excited" floating />
          <div>
            <div className="text-5xl mb-3">🌟</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Entry Saved!</h2>
            <p className="text-white/60">
              {entries.length > 1
                ? `You now have ${entries.length} journal entries. Listen back and hear your growth!`
                : "Your first journal entry! Every recording is evidence of your courage."}
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => setStage('menu')} className="btn-ghost flex-1">View Journal</button>
            <button onClick={() => navigate('/home')} className="btn-aqua flex-1">Back Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
