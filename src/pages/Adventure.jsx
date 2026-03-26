import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getZoneProgress, saveZoneProgress, addSession, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse, analyzeAttempt } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const ZONES = [
  {
    id: 'whispering_woods',
    name: 'Whispering Woods',
    icon: '🌲',
    skill: 'Gentle Onset',
    desc: 'Learn to start sounds softly, like a feather landing on water',
    color: 'from-green-600 to-emerald-500',
    bg: 'bg-green-500/10 border-green-500/30',
    missions: [
      { id: 1, title: 'The First Leaf', task: 'Whisper your name 5 times, starting each sound as gently as possible', type: 'whisper' },
      { id: 2, title: 'The Soft Wind', task: 'Read this aloud gently: "The wind whispers through the tall green trees..."', type: 'read' },
      { id: 3, title: 'The Gentle Giant', task: 'Say hello to an imaginary animal in the forest. Start very softly.', type: 'speak' },
      { id: 4, title: 'The Hidden Path', task: 'Describe what you see in the forest using slow, gentle words.', type: 'describe' },
      { id: 5, title: 'Forest Guardian', task: 'Tell the forest one thing you\'re proud of, starting every word gently.', type: 'brave' },
    ]
  },
  {
    id: 'breath_mountain',
    name: 'Breath Mountain',
    icon: '🏔️',
    skill: 'Diaphragmatic Breathing',
    desc: 'Climb higher with each breath. Your breath is your engine.',
    color: 'from-blue-600 to-cyan-500',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    missions: [
      { id: 1, title: 'Base Camp', task: 'Do 3 deep belly breaths. Feel your stomach rise — not your chest.', type: 'breathe' },
      { id: 2, title: 'The Climb', task: 'Breathe in for 4 counts, hold for 2, speak one sentence, breathe out.', type: 'breathe_speak' },
      { id: 3, title: 'Thin Air', task: 'Read this slowly, breathing before each phrase: "I am / climbing higher / every single day"', type: 'read' },
      { id: 4, title: 'Summit Wind', task: 'Take a breath and speak for 10 seconds about what you can see from the top.', type: 'speak' },
      { id: 5, title: 'Mountain Master', task: 'Guide Flux up the mountain by speaking calm, breathing sentences for 30 seconds.', type: 'brave' },
    ]
  },
  {
    id: 'echo_caves',
    name: 'Echo Caves',
    icon: '🪨',
    skill: 'Continuous Phonation',
    desc: 'Keep your voice flowing like an echo that never stops',
    color: 'from-bloom-600 to-indigo-500',
    bg: 'bg-violet-500/10 border-bloom-500/30',
    missions: [
      { id: 1, title: 'First Echo', task: 'Say "HELLO" and hold the final vowel for 3 full seconds. Helooooo...', type: 'prolong' },
      { id: 2, title: 'The Tunnel', task: 'Connect these words without stopping: "My... name... flows... like... water..."', type: 'connect' },
      { id: 3, title: 'Cave Song', task: 'Hum a melody for 10 seconds. Keep the sound flowing without breaks.', type: 'hum' },
      { id: 4, title: 'Deep Echo', task: 'Say a full sentence connecting every word smoothly: "I am learning to let my voice flow."', type: 'read' },
      { id: 5, title: 'Cave Master', task: 'Tell a 30-second story where your voice never fully stops. Keep flowing!', type: 'brave' },
    ]
  },
  {
    id: 'bravery_bridge',
    name: 'Bravery Bridge',
    icon: '🌉',
    skill: 'Desensitization',
    desc: 'Cross the bridge one brave step at a time. Fear shrinks when you face it.',
    color: 'from-brave-600 to-orange-500',
    bg: 'bg-amber-500/10 border-brave-500/30',
    missions: [
      { id: 1, title: 'First Step', task: 'Say your name out loud 3 times, even if you stutter. That\'s the mission.', type: 'brave' },
      { id: 2, title: 'Midway', task: 'Pretend to introduce yourself to a stranger. Don\'t avoid. Just try.', type: 'roleplay' },
      { id: 3, title: 'The Wobble', task: 'Stutter ON PURPOSE on the word "brave". Say: "I am b-b-b-brave."', type: 'voluntary' },
      { id: 4, title: 'Crossing', task: 'Ask a pretend teacher a question out loud. Don\'t substitute words.', type: 'roleplay' },
      { id: 5, title: 'Bridge Champion', task: 'Voluntarily stutter 3 times in a sentence. Earn TRIPLE Brave Stars!', type: 'voluntary' },
    ]
  },
  {
    id: 'story_city',
    name: 'Story City',
    icon: '🏙️',
    skill: 'Real-World Speaking',
    desc: 'Practice the situations that matter most in everyday life',
    color: 'from-yellow-600 to-brave-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    missions: [
      { id: 1, title: 'The Coffee Shop', task: 'Order your favourite drink out loud. Say it fully, don\'t substitute.', type: 'roleplay' },
      { id: 2, title: 'The Classroom', task: 'Answer a question in class: "The capital of France is Paris."', type: 'speak' },
      { id: 3, title: 'The Phone Call', task: 'Call an imaginary friend and say "Hi, it\'s [your name], how are you?"', type: 'roleplay' },
      { id: 4, title: 'The Presentation', task: 'Give a 30-second speech about your favourite thing. One breath at a time.', type: 'speak' },
      { id: 5, title: 'City Speaker', task: 'Introduce yourself to the whole city. Full name, one thing you love, one dream.', type: 'brave' },
    ]
  },
  {
    id: 'flow_river',
    name: 'The Flow River',
    icon: '🌊',
    skill: 'Full Fluency Integration',
    desc: 'Bring everything together. This is where you find your flow.',
    color: 'from-cyan-500 to-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    missions: [
      { id: 1, title: 'First Current', task: 'Speak for 20 seconds using: gentle onset + slow rate + continuous phonation', type: 'integrate' },
      { id: 2, title: 'The Rapids', task: 'Tell a story using everything you\'ve learned. 30 seconds. No stopping.', type: 'story' },
      { id: 3, title: 'Deep Water', task: 'Speak to Flux about something that matters to you. Brave, honest, free.', type: 'brave' },
      { id: 4, title: 'Flow State', task: 'Describe your YoSpeech journey so far. What changed? What are you proud of?', type: 'reflect' },
      { id: 5, title: '🏆 FLOW MASTER', task: 'Your final challenge: speak for 60 seconds on any topic. Use every technique. This is your flow.', type: 'champion' },
    ]
  },
]

export default function Adventure() {
  const [zoneProgress, setZoneProgress] = useState({})
  const [activeZone, setActiveZone] = useState(null)
  const [activeMission, setActiveMission] = useState(null)
  const [missionState, setMissionState] = useState('brief') // brief | active | done
  const [recording, setRecording] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const navigate = useNavigate()
  const { triggerFlux, refreshProfile, profile } = useApp()
  const { fluxSay, fluxSpeaking } = useFluxVoice()

  useEffect(() => { loadProgress() }, [])

  const loadProgress = async () => {
    const prog = {}
    for (const zone of ZONES) {
      const entries = await getZoneProgress(zone.id)
      prog[zone.id] = entries.length
    }
    setZoneProgress(prog)
  }

  const handleMissionStart = (zone, mission) => {
    setActiveZone(zone)
    setActiveMission(mission)
    setMissionState('brief')
    setFeedback('')
    fluxSay(`${mission.title}. ${mission.task}`, true)
  }

  const handleMissionComplete = async () => {
    setLoadingFeedback(true)
    try {
      const fb = await analyzeAttempt(
        `Completed "${activeMission.title}" in ${activeZone.name} — task: ${activeMission.task}`,
        activeZone.skill,
        profile
      )
      setFeedback(fb)
    } catch {
      setFeedback(getOfflineResponse('celebration'))
    }
    setLoadingFeedback(false)

    const isVoluntary = activeMission.type === 'voluntary'
    const stars = isVoluntary ? 30 : activeMission.type === 'brave' ? 25 : 15

    await saveZoneProgress(activeZone.id, activeMission.id, stars)
    await addSession('adventure', stars, { zone: activeZone.id, mission: activeMission.id })
    await markTodayStreak()
    await refreshProfile()
    await loadProgress()

    if (isVoluntary) {
      triggerFlux(getOfflineResponse('voluntary_stutter'))
    } else {
      triggerFlux(getOfflineResponse('celebration'))
    }
    setMissionState('done')
  }

  const getZoneStars = (zoneId) => zoneProgress[zoneId] || 0
  const isZoneLocked = (idx) => idx > 0 && getZoneStars(ZONES[idx - 1].id) < 3

  return (
    <div className="min-h-full pb-24 page-enter">
      {/* Zone Mission View */}
      {activeMission && (
        <div>
          <div className="flex items-center gap-3 px-5 pt-6 pb-4">
            <button onClick={() => setActiveMission(null)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
            <div>
              <h1 className="font-display text-lg font-bold text-white">{activeMission.title}</h1>
              <p className="text-white/40 text-xs">{activeZone.name} · {activeZone.skill}</p>
            </div>
          </div>

          <div className="px-5 flex flex-col gap-5">
            <Flux size={80} ageGroup={profile?.ageGroup || 'explorer'}
              mood={missionState === 'done' ? 'excited' : 'happy'}
              speaking={recording} floating />

            {missionState !== 'done' && (
              <>
                <div className={`p-5 rounded-2xl border bg-gradient-to-r ${activeZone.color} bg-opacity-10 ${activeZone.bg}`}>
                  <div className="text-white/60 text-xs mb-2">YOUR MISSION</div>
                  <p className="font-display text-white text-lg leading-relaxed">{activeMission.task}</p>
                </div>

                {activeMission.type === 'voluntary' && (
                  <div className="p-4 rounded-2xl bg-amber-500/20 border border-brave-500/30">
                    <p className="text-brave-300 text-sm font-bold">⭐ BRAVE BONUS MISSION</p>
                    <p className="text-white/70 text-sm mt-1">Voluntary stuttering is the most powerful desensitization technique. You earn TRIPLE stars for this one.</p>
                  </div>
                )}

                <button
                  onPointerDown={() => setRecording(true)}
                  onPointerUp={() => setRecording(false)}
                  onPointerLeave={() => setRecording(false)}
                  className={`py-5 rounded-2xl font-display font-bold text-white text-lg transition-all active:scale-95 ${
                    recording ? 'bg-red-500 shadow-red-500/30 shadow-lg' : 'bg-white/10 border border-white/20'
                  }`}
                >
                  {recording ? '🎙️ Speaking...' : '🎙️ Hold & Speak'}
                </button>

                <button onClick={handleMissionComplete} className="btn-amber w-full py-4">
                  Mark Complete ✓
                </button>
              </>
            )}

            {missionState === 'done' && (
              <div className="flex flex-col gap-4 text-center">
                <div className="text-5xl">🏆</div>
                <h2 className="font-display text-2xl font-bold text-white">Mission Complete!</h2>

                {loadingFeedback ? (
                  <div className="flex gap-1 justify-center">
                    {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                  </div>
                ) : feedback && (
                  <div className="glass rounded-2xl px-4 py-3 text-white/80 text-sm leading-relaxed text-left">
                    {feedback}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setActiveMission(null)} className="btn-ghost flex-1">More Missions</button>
                  <button onClick={() => navigate('/home')} className="btn-aqua flex-1">Home</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* World Map */}
      {!activeMission && (
        <>
          <div className="flex items-center gap-3 px-5 pt-6 pb-4">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
            <h1 className="font-display text-xl font-bold text-white flex-1">Adventure Mode</h1>
            <span className="text-2xl">🗺️</span>
          </div>

          <div className="flex flex-col items-center mb-4 px-5">
            <Flux size={70} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating
              showMessage message="Six worlds await! Each one trains a different speech skill. 🗺️" />
          </div>

          <div className="px-5 space-y-4">
            {ZONES.map((zone, idx) => {
              const stars = getZoneStars(zone.id)
              const locked = isZoneLocked(idx)

              return (
                <div
                  key={zone.id}
                  className={`zone-card ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} border ${zone.bg}`}
                  onClick={() => !locked && setActiveZone(activeZone?.id === zone.id ? null : zone)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${zone.color} opacity-10 rounded-3xl`} />
                  <div className="relative flex items-center gap-4">
                    <div className="text-4xl">{zone.icon}</div>
                    <div className="flex-1">
                      <div className="font-display font-bold text-white text-lg">{zone.name}</div>
                      <div className="text-white/50 text-sm">{zone.skill}</div>
                      <div className="flex gap-1 mt-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={`text-sm transition-all ${i < stars ? 'text-yellow-400' : 'text-white/20'}`}>★</span>
                        ))}
                      </div>
                    </div>
                    {locked ? <span className="text-2xl">🔒</span> : <span className="text-white/40">▼</span>}
                  </div>

                  {/* Missions list */}
                  {activeZone?.id === zone.id && !locked && (
                    <div className="relative mt-4 space-y-2">
                      {zone.missions.map(mission => (
                        <button
                          key={mission.id}
                          onClick={(e) => { e.stopPropagation(); handleMissionStart(zone, mission) }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-left"
                        >
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white/70">
                            {mission.id}
                          </div>
                          <div className="flex-1">
                            <div className="text-white text-sm font-display">{mission.title}</div>
                            <div className="text-white/40 text-xs">{mission.task.slice(0, 45)}...</div>
                          </div>
                          {mission.type === 'voluntary' && <span className="text-amber text-xs">⭐⭐⭐</span>}
                          <span className="text-white/30 text-sm">→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
