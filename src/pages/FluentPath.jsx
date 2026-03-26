import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak, getSetting, setSetting } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import {
  FLUENCY_CURRICULUM, STUTTER_MODIFICATION_DRILLS, METRONOME_PRESETS,
  getOfflineResponse, getOfflineAttemptFeedback
} from '../ai/fluxEngine'
import { speak, stopSpeaking, ttsAvailable } from '../ai/voiceEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const TABS = [
  { id: 'curriculum', label: 'FluentPath', icon: '🗺️' },
  { id: 'modification', label: 'Modification', icon: '🌊' },
  { id: 'metronome', label: 'Metronome', icon: '🎵' },
]

// ── Metronome using Web Audio API ──────────────────────────────────────────────
function Metronome({ bpm, running }) {
  const ctxRef = useRef(null)
  const nextRef = useRef(0)
  const timerRef = useRef(null)

  const beep = useCallback(() => {
    if (!ctxRef.current) return
    const ctx = ctxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  }, [])

  const schedule = useCallback(() => {
    const interval = 60 / bpm
    while (nextRef.current < ctxRef.current.currentTime + 0.1) {
      beep()
      nextRef.current += interval
    }
    timerRef.current = setTimeout(schedule, 25)
  }, [bpm, beep])

  useEffect(() => {
    if (running) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      nextRef.current = ctxRef.current.currentTime
      schedule()
    } else {
      clearTimeout(timerRef.current)
      ctxRef.current?.close()
      ctxRef.current = null
    }
    return () => {
      clearTimeout(timerRef.current)
      ctxRef.current?.close()
    }
  }, [running, schedule])

  return null
}

export default function FluentPath() {
  const [tab, setTab] = useState('curriculum')
  const [weekProgress, setWeekProgress] = useState({})
  const [activeDrill, setActiveDrill] = useState(null)
  const [drillStep, setDrillStep] = useState(0)
  const [practicePromptIdx, setPracticePromptIdx] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [metBpm, setMetBpm] = useState(110)
  const [metRunning, setMetRunning] = useState(false)
  const [activeWeek, setActiveWeek] = useState(0)
  const [fluxMsg, setFluxMsg] = useState(getOfflineResponse('encouragement'))
  const [sessionDone, setSessionDone] = useState(false)
  const navigate = useNavigate()
  const { profile, refreshProfile, triggerFlux } = useApp()
  const { fluxSay } = useFluxVoice()
  const ag = profile?.ageGroup || 'explorer'

  useEffect(() => {
    getSetting('fluentpath_progress', {}).then(p => setWeekProgress(p || {}))
  }, [])

  const markDayDone = async (week, day) => {
    const key = `w${week}_d${day}`
    const updated = { ...weekProgress, [key]: true }
    setWeekProgress(updated)
    await setSetting('fluentpath_progress', updated)
    await addSession('fluentpath', 85, { week, day })
    await markTodayStreak()
    await refreshProfile()
    const msg = getOfflineResponse('celebration')
    setFluxMsg(msg)
    fluxSay(msg)
    triggerFlux(msg)
  }

  const isDayDone = (week, day) => weekProgress[`w${week}_d${day}`]

  const getWeekCompletion = (weekIdx) => {
    const week = FLUENCY_CURRICULUM[weekIdx]
    return week.daily.filter(d => isDayDone(weekIdx, d.day)).length
  }

  const startDrill = (drill) => {
    setActiveDrill(drill)
    setDrillStep(0)
    setPracticePromptIdx(0)
    setFeedback('')
  }

  const completeDrill = async () => {
    const fb = getOfflineAttemptFeedback(activeDrill.id)
    setFeedback(fb)
    setSessionDone(true)
    await addSession(`drill_${activeDrill.id}`, 90, { drill: activeDrill.id })
    await markTodayStreak()
    await refreshProfile()
    const msg = getOfflineResponse(activeDrill.id === 'voluntary_stutter' ? 'voluntary_stutter' : 'celebration')
    setFluxMsg(msg)
    fluxSay(msg)
    triggerFlux(msg)
  }

  const speakPrompt = (text) => {
    if (ttsAvailable()) speak(text, { ageGroup: ag, rate: 0.8 })
  }

  return (
    <div className="relative min-h-full pb-28" style={{ zIndex: 1 }}>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(-1)} className="w-9 h-9 glass rounded-xl flex items-center justify-center text-white/60">←</button>
          <div>
            <h1 className="text-xl font-bold font-display text-white">FluentPath</h1>
            <p className="text-xs text-white/40">Fluency shaping · Modification · Metronome</p>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="card flex items-start gap-3">
          <div className="animate-flux-float flex-shrink-0">
            <Flux size={44} ageGroup={ag} mood="happy" />
          </div>
          <p className="text-white/80 text-sm leading-relaxed">{fluxMsg}</p>
        </div>
      </div>

      <div className="px-4 mb-5 flex gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setActiveDrill(null); setSessionDone(false) }}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold font-display transition-all ${tab === t.id ? 'text-[#05080f]' : 'glass text-white/50'}`}
            style={tab === t.id ? { background: 'var(--aqua)' } : {}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── CURRICULUM ── */}
      {tab === 'curriculum' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card">
            <p className="text-white/70 text-sm leading-relaxed">
              A structured 4-week fluency shaping program based on Guitar's Integrated Approach. Complete one daily task each day — 7 days per week.
            </p>
          </div>

          {FLUENCY_CURRICULUM.map((week, wi) => {
            const done = getWeekCompletion(wi)
            const expanded = activeWeek === wi
            return (
              <div key={wi} className="card-lg space-y-3">
                <button onClick={() => setActiveWeek(expanded ? -1 : wi)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">Week {week.week}: {week.title}</p>
                      <p className="text-white/40 text-xs mt-0.5">{week.focus}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{done}/7</span>
                      <span className="text-white/40">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  <div className="prog-track mt-2">
                    <div className="prog-fill" style={{ width: `${(done / 7) * 100}%`, background: done === 7 ? 'var(--jade)' : 'var(--aqua)' }} />
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {week.techniques.map(t => (
                        <span key={t} className="pill-aqua text-xs">{t.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                    {week.daily.map(day => (
                      <div key={day.day} className={`glass rounded-xl p-3 flex items-start gap-3 border transition-all ${isDayDone(wi, day.day) ? 'border-jade/30' : 'border-transparent'}`}>
                        <button onClick={() => !isDayDone(wi, day.day) && markDayDone(wi, day.day)}
                          className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all mt-0.5 ${isDayDone(wi, day.day) ? 'border-jade bg-jade/20' : 'border-white/20 hover:border-aqua/50'}`}>
                          {isDayDone(wi, day.day) && <span className="text-jade text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/40 text-xs mb-0.5">Day {day.day} · <span className="capitalize">{day.type.replace(/_/g, ' ')}</span></p>
                          <p className="text-white/80 text-sm leading-relaxed">{day.task}</p>
                          {!isDayDone(wi, day.day) && (
                            <button onClick={() => { speakPrompt(day.task); setTimeout(() => markDayDone(wi, day.day), 3000) }}
                              className="mt-2 text-xs text-aqua/70 hover:text-aqua transition-colors">
                              🔊 Read aloud + mark done
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODIFICATION DRILLS ── */}
      {tab === 'modification' && (
        <div className="px-4 space-y-4 animate-fade-in">
          {activeDrill ? (
            <div className="space-y-4 animate-scale-in">
              <div className="card-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{activeDrill.icon}</span>
                    <h3 className="text-white font-bold">{activeDrill.title}</h3>
                  </div>
                  <button onClick={() => { setActiveDrill(null); setSessionDone(false) }} className="text-white/40 text-sm">✕</button>
                </div>
                <p className="text-white/60 text-sm leading-relaxed mb-4">{activeDrill.description}</p>

                {!sessionDone ? (
                  <>
                    {/* Steps */}
                    <div className="space-y-2 mb-4">
                      {activeDrill.steps.map((step, i) => (
                        <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all ${drillStep === i ? 'glass border border-aqua/20' : ''}`}>
                          <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${i < drillStep ? 'bg-jade/20 text-jade' : i === drillStep ? 'text-[#05080f]' : 'bg-white/10 text-white/30'}`}
                            style={i === drillStep ? { background: 'var(--aqua)' } : {}}>
                            {i < drillStep ? '✓' : i + 1}
                          </span>
                          <p className={`text-sm leading-relaxed ${i === drillStep ? 'text-white' : i < drillStep ? 'text-jade/70' : 'text-white/30'}`}>{step}</p>
                        </div>
                      ))}
                    </div>

                    {/* Practice prompt */}
                    <div className="glass rounded-xl p-4 mb-4 border border-aqua/15">
                      <p className="text-white/40 text-xs mb-1">Practice prompt</p>
                      <p className="text-white/80 text-sm">{activeDrill.practicePrompts[practicePromptIdx]}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => speakPrompt(activeDrill.practicePrompts[practicePromptIdx])}
                          className="text-xs text-aqua/70 hover:text-aqua">🔊 Hear it</button>
                        <button onClick={() => setPracticePromptIdx(i => (i + 1) % activeDrill.practicePrompts.length)}
                          className="text-xs text-white/40 hover:text-white/70">↻ Next prompt</button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {drillStep < activeDrill.steps.length - 1 ? (
                        <button onClick={() => setDrillStep(s => s + 1)} className="flex-1 btn-aqua py-3 text-sm">
                          Next step →
                        </button>
                      ) : (
                        <button onClick={completeDrill} className="flex-1 btn-jade py-3 text-sm">
                          ✓ Complete drill
                        </button>
                      )}
                      {drillStep > 0 && (
                        <button onClick={() => setDrillStep(s => s - 1)} className="btn-ghost py-3 px-4 text-sm">←</button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <div className="text-3xl">⭐</div>
                    <p className="text-white font-bold">Drill complete!</p>
                    <p className="text-white/70 text-sm leading-relaxed">{feedback}</p>
                    <button onClick={() => { setActiveDrill(null); setSessionDone(false) }} className="btn-ghost py-3 px-6 text-sm">
                      Back to drills
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="card">
                <p className="text-white/70 text-sm leading-relaxed">
                  Van Riper's stuttering modification techniques. These don't target fluency — they target your <em>response</em> to stuttering. Use after fluency shaping for maximum impact.
                </p>
              </div>
              {STUTTER_MODIFICATION_DRILLS.map(drill => (
                <button key={drill.id} onClick={() => startDrill(drill)}
                  className="w-full card-lg text-left hover:border-aqua/20 transition-all active:scale-95 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{drill.icon}</span>
                    <div>
                      <p className="text-white font-semibold">{drill.title}</p>
                      <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{drill.description.slice(0, 80)}...</p>
                    </div>
                    <span className="text-white/30 ml-auto">→</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {drill.steps.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs text-white/30 glass rounded-lg px-2 py-0.5 truncate max-w-[120px]">{s.slice(0, 30)}…</span>
                    ))}
                  </div>
                </button>
              ))}

              {/* Clinical note */}
              <div className="glass rounded-2xl p-4 border border-amber/20">
                <p className="text-amber/80 text-xs font-semibold mb-1">Clinical note</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Voluntary stuttering (⭐) is the most advanced technique here. Research consistently shows it's the fastest route to desensitisation. Start with cancellation if you're newer to modification work.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── METRONOME ── */}
      {tab === 'metronome' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <Metronome bpm={metBpm} running={metRunning} />

          <div className="card">
            <p className="text-white/70 text-sm leading-relaxed">
              Rhythm-timed speech: speak one syllable per beat. This activates a secondary motor pathway that bypasses the disrupted basal ganglia circuit — which is why rhythm dramatically improves fluency.
            </p>
          </div>

          {/* BPM display */}
          <div className="card-lg text-center space-y-4">
            <div className={`text-6xl font-bold font-display transition-all ${metRunning ? 'text-aqua' : 'text-white/40'}`}>
              {metBpm}
              <span className="text-2xl text-white/30 ml-1">BPM</span>
            </div>
            {metRunning && (
              <div className="flex justify-center gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-aqua animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            <input type="range" min="60" max="180" step="5"
              value={metBpm}
              onChange={e => setMetBpm(Number(e.target.value))}
              className="w-full" />
            <p className="text-white/40 text-xs">{metBpm < 100 ? 'Therapeutic range — most effective' : metBpm < 130 ? 'Moderate pace' : 'Near-normal rate'}</p>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-2 gap-3">
            {METRONOME_PRESETS.map(preset => (
              <button key={preset.bpm} onClick={() => setMetBpm(preset.bpm)}
                className={`card text-left transition-all active:scale-95 ${metBpm === preset.bpm ? 'border-aqua/30' : ''}`}>
                <p className="text-white font-semibold text-sm">{preset.label.split(' (')[0]}</p>
                <p className="text-white/40 text-xs mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>

          <button onClick={() => setMetRunning(r => !r)}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 ${metRunning ? 'btn-danger' : 'btn-aqua'}`}>
            {metRunning ? '■ Stop Metronome' : '▶ Start Metronome'}
          </button>

          {/* Practice guide */}
          <div className="card-lg space-y-3">
            <p className="text-white/70 text-sm font-semibold">How to practice</p>
            {[
              'Start at 90-100 BPM. One syllable per beat.',
              'Begin with single words: "hel-lo", "to-day", "my-name".',
              'Progress to short phrases over 5-10 minutes.',
              'Gradually increase BPM over sessions.',
              'Transfer to conversation — aim for the same rhythm naturally.',
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-aqua/20 flex items-center justify-center text-aqua text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-white/60 text-sm">{tip}</p>
              </div>
            ))}
          </div>

          {metRunning && (
            <div className="glass rounded-2xl p-4 border border-aqua/20 animate-pulse-ring">
              <p className="text-aqua/80 text-sm font-semibold">🎵 Metronome running</p>
              <p className="text-white/50 text-xs mt-1">Speak one syllable per beat. Keep it light and rhythmic.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
