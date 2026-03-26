import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { analyzeCommSkill, generatePresentationPlan, getOfflineResponse, updateMemoryAfterSession } from '../ai/fluxEngine'
import { speak, stopSpeaking, ttsAvailable } from '../ai/voiceEngine'
import useFluxVoice from '../hooks/useFluxVoice'
import Flux from '../components/flux/Flux'

const SKILL_MODULES = [
  {
    id: 'clarity',
    title: 'Clarity & Diction',
    icon: '🔍',
    desc: 'Speak clearly so every word lands',
    color: 'from-cyan-500/20 to-sky-600/20',
    border: 'border-cyan-500/25',
    pill: 'pill-aqua',
    exercises: [
      { title: 'Tongue Twisters', task: 'Say clearly 3 times: "She sells seashells by the seashore"', target: 'articulation' },
      { title: 'The News Reader', task: 'Read this headline slowly and clearly: "Scientists discover a new species of deep sea fish that can glow in complete darkness"', target: 'enunciation' },
      { title: 'Whisper Power', task: 'Whisper a full sentence so it is still perfectly clear: "I am speaking with clarity and intention"', target: 'precision' },
    ]
  },
  {
    id: 'pacing',
    title: 'Pacing & Pauses',
    icon: '⏸️',
    desc: 'Control the rhythm of your speech',
    color: 'from-violet-500/20 to-purple-600/20',
    border: 'border-violet-500/25',
    pill: 'pill-violet',
    exercises: [
      { title: 'The Power Pause', task: 'Say: "I have something important to tell you." Then pause for 3 full seconds before saying "Are you ready?"', target: 'pause' },
      { title: 'Slow It Down', task: 'Say this at exactly HALF your normal speed: "The most important thing you need to know about me is..."', target: 'rate' },
      { title: 'Dramatic Timing', task: 'Build suspense: "There was one thing I never expected to happen." Pause 2 seconds. Then: "And it changed everything."', target: 'timing' },
    ]
  },
  {
    id: 'projection',
    title: 'Vocal Projection',
    icon: '📢',
    desc: 'Fill the room with your voice',
    color: 'from-amber-500/20 to-orange-600/20',
    border: 'border-amber-500/25',
    pill: 'pill-amber',
    exercises: [
      { title: 'Room Filler', task: 'Imagine speaking to 50 people. Project your voice: "Good morning everyone! Thank you for being here today."', target: 'volume' },
      { title: 'Resonance Check', task: 'Hum at the bottom of your range, feel the vibration in your chest, then speak: "My voice has depth and power."', target: 'resonance' },
      { title: 'Distance Test', task: 'Speak as if talking to someone across a large room — loud but not shouting: "Can everyone at the back hear me clearly?"', target: 'projection' },
    ]
  },
  {
    id: 'storytelling',
    title: 'Storytelling Structure',
    icon: '📖',
    desc: 'Make people lean in when you speak',
    color: 'from-jade-500/20 to-emerald-600/20',
    border: 'border-jade-500/25',
    pill: 'pill-jade',
    exercises: [
      { title: 'The Hook', task: "Open with a hook — no introduction, no \"um\": tell me a 30-second story that starts with \"The day everything changed was...\" — dive straight in, no preamble.", target: 'opening' },
      { title: 'Show Don\'t Tell', task: 'Instead of "I was nervous", paint the picture: describe your body, the room, what you heard. 20 seconds. Never say the emotion — make me feel it.', target: 'vivid' },
      { title: 'The Callback', task: 'Tell a 45-second story. Start with a specific detail. End by referencing that exact same detail. That\'s a callback — the most powerful story closing tool.', target: 'structure' },
      { title: 'Carnegie Formula', task: 'Pick a belief or skill you changed. Tell it: Incident (what happened) → Action (what you did) → Benefit (what changed). 45 seconds. This is Dale Carnegie\'s proven formula.', target: 'formula' },
      { title: 'Rule of Three', task: 'Give your opinion on any topic. Structure it: "There are three things... First... Second... Third..." The rule of three is the most memorable speech structure.', target: 'structure' },
    ]
  },
  {
    id: 'real_world',
    title: 'Real-World Scenarios',
    icon: '🌍',
    desc: 'Perform under pressure in real situations',
    color: 'from-violet-500/20 to-indigo-600/20',
    border: 'border-violet-500/25',
    pill: 'pill-violet',
    exercises: [
      { title: 'Give Honest Feedback', task: 'Tell a friend their presentation was unclear — be honest but kind. Use: "I noticed...", "What I think would help is...", "I say this because I believe in you." 30 seconds.', target: 'feedback' },
      { title: 'Say No Clearly', task: 'Someone asks you to do something you can\'t do. Decline directly without over-explaining. "I\'m not able to because... What I can do is..." No apologising. No rambling. 20 seconds.', target: 'boundary' },
      { title: 'Difficult Conversation', task: 'You\'ve been treated unfairly. Address it directly: describe the behaviour (not the person), the impact on you, and what you need going forward. No attacks, no vagueness. 45 seconds.', target: 'conflict' },
      { title: 'Networking Introduction', task: 'You\'re at a professional event. Introduce yourself memorably in 30 seconds: who you are, what you do, one surprising or interesting detail. Zero fillers. Start immediately.', target: 'networking' },
    ]
  },
  {
    id: 'confidence',
    title: 'Confident Presence',
    icon: '👑',
    desc: 'Project authority in any room',
    color: 'from-rose-500/20 to-pink-600/20',
    border: 'border-rose-500/25',
    pill: 'pill-rose',
    exercises: [
      { title: 'No Filler Words', task: 'Answer this question with ZERO ums, uhs, or likes: "Tell me about yourself in 30 seconds."', target: 'fillers' },
      { title: 'The Confident Opener', task: 'Start speaking immediately — no "um" or "so". Just: "My name is [name] and I am here to talk about [your favourite topic]."', target: 'opener' },
      { title: 'Strong Opinion', task: 'Give a clear 20-second opinion on any topic. Use: "I believe...", "The reason is...", "Therefore..."', target: 'conviction' },
    ]
  },
  {
    id: 'interview',
    title: 'Interview & Professional',
    icon: '💼',
    desc: 'Own any professional conversation',
    color: 'from-sky-500/20 to-blue-600/20',
    border: 'border-sky-500/25',
    pill: 'pill-aqua',
    exercises: [
      { title: 'STAR Method', task: 'Answer: "Tell me about a challenge you overcame." Use: Situation → Task → Action → Result. 45 seconds.', target: 'structure' },
      { title: 'Elevator Pitch', task: '30-second pitch: who you are, what you do, and what makes you valuable. No notes. Go.', target: 'pitch' },
      { title: 'Difficult Question', task: '"What is your greatest weakness?" Answer honestly but positively in under 30 seconds.', target: 'handling' },
    ]
  },
]

const PRESENTATION_TOPICS = [
  'My biggest life lesson', 'Why I do what I do', 'Something I changed my mind about',
  'A skill everyone should learn', 'The best advice I ever received', 'My vision for the future',
]

export default function CommAcademy() {
  const [view, setView] = useState('home') // home | module | exercise | presentation | done
  const [activeModule, setActiveModule] = useState(null)
  const [activeExercise, setActiveExercise] = useState(null)
  const [exerciseIdx, setExerciseIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [presView, setPresView] = useState('setup') // setup | plan | practice | feedback
  const [presTopic, setPresTopic] = useState('')
  const [presDuration, setPresDuration] = useState(60)
  const [presPlan, setPresPlan] = useState(null)
  const [micError, setMicError] = useState(false)
  const [waveform, setWaveform] = useState(Array(24).fill(3))

  const mediaRecRef  = useRef(null)
  const audioCtxRef  = useRef(null)
  const analyserRef  = useRef(null)
  const animRef      = useRef(null)
  const chunksRef    = useRef([])
  const recRef       = useRef(null)

  const navigate    = useNavigate()
  const { profile, refreshProfile } = useApp()
  const { fluxSay, fluxSpeaking }   = useFluxVoice()

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 64
      audioCtxRef.current.createMediaStreamSource(stream).connect(analyserRef.current)
      mediaRecRef.current = stream

      // Waveform animation
      const draw = () => {
        const d = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(d)
        setWaveform(Array.from({length:24},(_,i) => Math.max(3, (d[Math.floor(i*d.length/24)]||0)/255*50)))
        animRef.current = requestAnimationFrame(draw)
      }
      draw()

      // Speech recognition
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recRef.current = new SR()
        recRef.current.continuous = true
        recRef.current.interimResults = false
        recRef.current.onresult = e => {
          const t = Array.from(e.results).map(r=>r[0].transcript).join(' ')
          setTranscript(t)
        }
        recRef.current.start()
      }
      setMicError(false)
    } catch { setMicError(true) }
  }

  const stopMic = () => {
    cancelAnimationFrame(animRef.current)
    mediaRecRef.current?.getTracks().forEach(t=>t.stop())
    audioCtxRef.current?.close().catch(()=>{})
    recRef.current?.stop()
    setWaveform(Array(24).fill(3))
  }

  const startExercise = async (mod, ex, idx) => {
    setActiveModule(mod)
    setActiveExercise(ex)
    setExerciseIdx(idx)
    setAnalysis(null)
    setTranscript('')
    setView('exercise')
    await startMic()
    fluxSay(ex.task, true)
  }

  const finishExercise = async () => {
    if (!transcript.trim() && !recording) return
    stopMic()
    setRecording(false)
    setLoadingAnalysis(true)

    try {
      const result = await analyzeCommSkill(activeModule.id, transcript || 'User completed exercise', profile)
      setAnalysis(result)
      fluxSay(result.praise, true)
      await addSession('comm_' + activeModule.id, result.score || 50, { exercise: activeExercise.title, transcript, score: result.score })
      await markTodayStreak()
      await updateMemoryAfterSession('comm_' + activeModule.id, { exercise: activeExercise.title, score: result.score }, profile)
      await refreshProfile()
    } catch {
      setAnalysis({ score: 70, strengths: ['You completed the exercise'], improvements: ['Keep practicing'], tip: 'Try again with more confidence.', praise: getOfflineResponse('encouragement') })
    }
    setLoadingAnalysis(false)
    setView('done')
  }

  const buildPresentation = async () => {
    if (!presTopic.trim()) return
    setLoadingAnalysis(true)
    const plan = await generatePresentationPlan(presTopic, presDuration, profile)
    setPresPlan(plan)
    setLoadingAnalysis(false)
    setPresView('plan')
    fluxSay(`Great topic! Here's your plan for "${presTopic}". Read it, then practice your speech.`, true)
  }

  useEffect(() => () => { stopMic() }, [])

  const ScoreRing = ({ score }) => {
    const color = score >= 80 ? 'var(--jade)' : score >= 60 ? 'var(--amber)' : 'var(--rose)'
    const pct = `${score}, 100`
    return (
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={pct} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-bold text-xl" style={{color}}>{score}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full pb-28 page-enter" style={{ zIndex: 1 }}>
      <div className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button onClick={() => { stopMic(); setView('home'); if(view==='home') navigate(-1) }}
          className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
        <div>
          <h1 className="font-display text-xl font-bold text-white">Comm Academy</h1>
          <p className="text-white/35 text-xs">Communication mastery · 6 skill tracks</p>
        </div>
        <span className="ml-auto text-2xl">🎙️</span>
      </div>

      {/* ── Home ──────────────────────────────────────────────────────────── */}
      {view === 'home' && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-6">
            <Flux size={80} ageGroup={profile?.ageGroup||'explorer'} mood="happy" floating
              showMessage message={getOfflineResponse('comm_coaching')} />
          </div>

          {/* Presentation Builder CTA */}
          <button onClick={() => setView('presentation')}
            className="w-full relative overflow-hidden rounded-3xl p-5 mb-3 text-left active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(34,211,238,0.15))', border: '1px solid rgba(167,139,250,0.25)' }}>
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.3), transparent 70%)' }}/>
            <div className="relative">
              <div className="section-label mb-1">AI-Powered</div>
              <h2 className="font-display font-bold text-white text-lg">Presentation Builder</h2>
              <p className="text-white/50 text-sm mt-0.5">Pick a topic → AI builds your structure → Practice with Flux</p>
            </div>
            <div className="absolute bottom-3 right-4 text-3xl">🎤</div>
          </button>

          {/* Voice Lab shortcut */}
          <button onClick={() => navigate('/voicelab')}
            className="w-full relative overflow-hidden rounded-3xl p-5 mb-5 text-left active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(52,211,153,0.12))', border: '1px solid rgba(34,211,238,0.2)' }}>
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.25), transparent 70%)' }}/>
            <div className="relative">
              <div className="section-label mb-1" style={{ color: 'var(--aqua)' }}>6 Modules</div>
              <h2 className="font-display font-bold text-white text-lg">Voice Lab</h2>
              <p className="text-white/50 text-sm mt-0.5">Warm-Up · Filler Detector · Story Studio · Listening · Body Language · Impromptu</p>
            </div>
            <div className="absolute bottom-3 right-4 text-3xl">🎵</div>
          </button>

          {/* Skill modules */}
          <p className="section-label mb-3">Skill Tracks</p>
          <div className="space-y-2.5">
            {SKILL_MODULES.map((mod, i) => (
              <button key={mod.id} onClick={() => { setActiveModule(mod); setView('module') }}
                className={`w-full p-4 rounded-2xl border bg-gradient-to-r ${mod.color} ${mod.border} text-left active:scale-[0.98] transition-all flex items-center gap-4 animate-slide-up`}
                style={{ animationDelay: `${i*0.06}s` }}>
                <div className="text-3xl">{mod.icon}</div>
                <div className="flex-1">
                  <div className="font-display font-bold text-white">{mod.title}</div>
                  <div className="text-white/50 text-sm">{mod.desc}</div>
                </div>
                <div className={`${mod.pill} text-[10px]`}>{mod.exercises.length} ex</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Module ──────────────────────────────────────────────────────── */}
      {view === 'module' && activeModule && (
        <div className="px-5">
          <div className={`p-5 rounded-3xl border bg-gradient-to-br ${activeModule.color} ${activeModule.border} mb-5`}>
            <div className="text-4xl mb-2">{activeModule.icon}</div>
            <h2 className="font-display font-bold text-white text-xl">{activeModule.title}</h2>
            <p className="text-white/60 text-sm mt-1">{activeModule.desc}</p>
          </div>
          <div className="space-y-3">
            {activeModule.exercises.map((ex, i) => (
              <button key={i} onClick={() => startExercise(activeModule, ex, i)}
                className="w-full card text-left active:scale-[0.98] transition-transform flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl glass-2 flex items-center justify-center font-display font-bold text-sm text-white/60 flex-shrink-0 mt-0.5">
                  {i+1}
                </div>
                <div className="flex-1">
                  <div className="font-display font-semibold text-white text-sm">{ex.title}</div>
                  <div className="text-white/40 text-xs mt-0.5 line-clamp-2">{ex.task}</div>
                </div>
                <div className="text-white/25 flex-shrink-0">→</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Exercise ────────────────────────────────────────────────────── */}
      {view === 'exercise' && activeExercise && (
        <div className="px-5 flex flex-col gap-4">
          {/* Progress */}
          <div className="flex gap-1.5">
            {activeModule.exercises.map((_,i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < exerciseIdx ? 'bg-jade' : i === exerciseIdx ? 'bg-aqua' : 'bg-white/10'}`}
                   style={i < exerciseIdx ? {background:'var(--jade)'} : i===exerciseIdx ? {background:'var(--aqua)'} : {}}/>
            ))}
          </div>

          <div className="flex justify-center">
            <Flux size={80} ageGroup={profile?.ageGroup||'explorer'} mood={recording?'excited':'happy'}
              speaking={recording||fluxSpeaking} floating />
          </div>

          {/* Task card */}
          <div className={`p-5 rounded-2xl border bg-gradient-to-br ${activeModule.color} ${activeModule.border} relative`}>
            <div className="section-label mb-2">{activeModule.title} · {activeExercise.title}</div>
            <p className="text-white text-base leading-relaxed font-body">{activeExercise.task}</p>
            {ttsAvailable() && (
              <button onClick={() => speak(activeExercise.task, { ageGroup: profile?.ageGroup||'explorer', rate:0.8 })}
                className="mt-3 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                🔊 Hear instructions
              </button>
            )}
          </div>

          {/* Transcript preview */}
          {transcript && (
            <div className="card glass-2 text-white/60 text-sm leading-relaxed">
              <div className="section-label mb-1">What Flux heard</div>
              {transcript}
            </div>
          )}

          {/* Waveform */}
          <div className="flex items-end justify-center gap-0.5 h-10">
            {waveform.map((h,i) => (
              <div key={i} className="wave-bar w-1.5" style={{ height:`${recording?h:3}px`, opacity: recording?1:0.3 }}/>
            ))}
          </div>

          {micError && <p className="text-rose text-xs text-center" style={{color:'var(--rose)'}}>Mic unavailable — speak the exercise aloud and tap Complete ✓</p>}

          <div className="flex gap-3">
            <button onPointerDown={()=>setRecording(true)} onPointerUp={()=>setRecording(false)} onPointerLeave={()=>setRecording(false)}
              className="flex-1 py-4 rounded-2xl font-display font-bold transition-all active:scale-95"
              style={recording
                ? { background:'rgba(239,68,68,0.8)', color:'white', boxShadow:'0 4px 20px rgba(239,68,68,0.3)' }
                : { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.1)' }}>
              {recording ? '⏺ Speaking…' : '🎙️ Hold & Speak'}
            </button>
            <button onClick={finishExercise}
              className="btn-jade px-6 font-display text-sm">Done ✓</button>
          </div>
        </div>
      )}

      {/* ── Presentation Builder ─────────────────────────────────────────── */}
      {view === 'presentation' && presView === 'setup' && (
        <div className="px-5 flex flex-col gap-5">
          <div className="flex flex-col items-center">
            <Flux size={80} ageGroup={profile?.ageGroup||'explorer'} mood="happy" floating
              showMessage message="Pick a topic and I'll build your entire speech structure. Then you practice it!" />
          </div>

          <div>
            <p className="section-label mb-2">Your topic</p>
            <input value={presTopic} onChange={e=>setPresTopic(e.target.value)}
              placeholder="e.g. My biggest life lesson..."
              className="input-field mb-3" />
            <p className="section-label mb-2">Or choose a prompt</p>
            <div className="flex flex-wrap gap-2">
              {PRESENTATION_TOPICS.map(t => (
                <button key={t} onClick={() => setPresTopic(t)}
                  className={`text-xs px-3 py-2 rounded-xl transition-all active:scale-95 ${presTopic===t ? 'bg-violet-500/20 border-violet-500/40 text-violet' : 'glass text-white/50 hover:text-white/80'}`}
                  style={presTopic===t ? {border:'1px solid rgba(167,139,250,0.4)', color:'var(--violet)'} : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Target duration: {presDuration}s</p>
            <input type="range" min={20} max={180} step={10} value={presDuration} onChange={e=>setPresDuration(+e.target.value)} className="w-full"/>
            <div className="flex justify-between text-white/25 text-xs mt-1"><span>20s</span><span>3 min</span></div>
          </div>

          <button onClick={buildPresentation} disabled={!presTopic.trim()||loadingAnalysis}
            className="btn-violet w-full py-4 font-display disabled:opacity-40">
            {loadingAnalysis ? '🧠 Building your plan…' : 'Build My Presentation 🎤'}
          </button>
        </div>
      )}

      {view === 'presentation' && presView === 'plan' && presPlan && (
        <div className="px-5 flex flex-col gap-4">
          <div className="card" style={{ borderColor:'rgba(167,139,250,0.25)' }}>
            <div className="section-label mb-2">Your Speech Plan</div>
            <h2 className="font-display font-bold text-white text-lg mb-3">{presPlan.title}</h2>
            <div className="p-3 rounded-xl mb-3" style={{ background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.2)' }}>
              <div className="section-label mb-1">Opening Hook</div>
              <p className="text-white/80 text-sm italic">"{presPlan.openingHook}"</p>
            </div>
            <div className="section-label mb-2">Outline</div>
            {presPlan.outline?.map((pt,i) => (
              <div key={i} className="flex gap-3 items-start mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                     style={{background:'rgba(167,139,250,0.2)',color:'var(--violet)'}}>{i+1}</div>
                <p className="text-white/70 text-sm">{pt}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-label mb-2">Coach Tips</div>
            {presPlan.tips?.map((tip,i) => (
              <div key={i} className="flex gap-2 mb-2">
                <span style={{color:'var(--aqua)'}}>💡</span>
                <p className="text-white/60 text-sm">{tip}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPresView('setup')} className="btn-ghost flex-1">Change Topic</button>
            <button onClick={() => { setPresView('practice'); startMic() }} className="btn-violet flex-1 font-display">Practice Now 🎤</button>
          </div>
        </div>
      )}

      {view === 'presentation' && presView === 'practice' && (
        <div className="px-5 flex flex-col gap-4">
          <div className="flex justify-center">
            <Flux size={80} ageGroup={profile?.ageGroup||'explorer'} mood={recording?'excited':'happy'} speaking={recording} floating />
          </div>
          <div className="card text-center">
            <p className="text-white/50 text-xs mb-1">Target: {presDuration} seconds</p>
            <p className="font-display text-lg font-bold text-white">"{presTopic}"</p>
            <p className="text-white/40 text-xs mt-1">Use your outline. Start with the hook. Go!</p>
          </div>
          <div className="flex items-end justify-center gap-0.5 h-10">
            {waveform.map((h,i)=><div key={i} className="wave-bar w-1.5" style={{height:`${recording?h:3}px`,opacity:recording?1:0.3}}/>)}
          </div>
          {transcript && <div className="card text-white/50 text-xs">{transcript}</div>}
          <div className="flex gap-3">
            <button onPointerDown={()=>setRecording(true)} onPointerUp={()=>setRecording(false)} onPointerLeave={()=>setRecording(false)}
              className="flex-1 py-4 rounded-2xl font-display font-bold"
              style={recording?{background:'rgba(239,68,68,0.8)',color:'white'}:{background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.1)'}}>
              {recording?'⏺ Speaking…':'🎙️ Hold & Speak'}
            </button>
            <button onClick={finishExercise} className="btn-jade px-6 font-display text-sm">Finish ✓</button>
          </div>
        </div>
      )}

      {/* ── Done / Analysis ──────────────────────────────────────────────── */}
      {view === 'done' && analysis && (
        <div className="px-5 flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3">
            <Flux size={100} ageGroup={profile?.ageGroup||'explorer'} mood="excited" floating />
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-white">Analysis Complete!</h2>
              <p className="text-white/50 text-sm mt-1">{activeExercise?.title || presTopic}</p>
            </div>
          </div>

          {/* Score */}
          <div className="flex justify-center">
            <ScoreRing score={analysis.score||70} />
          </div>

          {/* Breakdown */}
          <div className="card" style={{ borderColor:'rgba(52,211,153,0.2)' }}>
            <div className="section-label mb-2" style={{color:'var(--jade)'}}>What you did well</div>
            {(analysis.strengths||[]).map((s,i)=>(
              <div key={i} className="flex gap-2 mb-1.5 items-start">
                <span style={{color:'var(--jade)'}}>✓</span><p className="text-white/75 text-sm">{s}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{ borderColor:'rgba(251,191,36,0.2)' }}>
            <div className="section-label mb-2" style={{color:'var(--amber)'}}>Next to work on</div>
            {(analysis.improvements||[]).map((s,i)=>(
              <div key={i} className="flex gap-2 mb-1.5 items-start">
                <span style={{color:'var(--amber)'}}>→</span><p className="text-white/75 text-sm">{s}</p>
              </div>
            ))}
            {analysis.tip && <p className="text-white/50 text-xs mt-2 pt-2 border-t border-white/8 italic">💡 {analysis.tip}</p>}
          </div>

          {/* Flux feedback */}
          <div className="flex gap-3 items-start card">
            <Flux size={36} ageGroup={profile?.ageGroup||'explorer'} mood="happy" />
            <p className="text-white/80 text-sm leading-relaxed flex-1">{analysis.praise}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setView('home'); setAnalysis(null); setTranscript('') }} className="btn-ghost flex-1">More Practice</button>
            <button onClick={() => navigate('/home')} className="btn-aqua flex-1 font-display" style={{color:'#05080f'}}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
