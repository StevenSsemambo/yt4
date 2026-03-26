import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getFearLadder, addFearItem, completeFearItem,
  addSession, addBraveStar, markTodayStreak
} from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import {
  generateBraveMission, getOfflineResponse, getOfflineMission,
  callFluxAI
} from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const PRESET_SITUATIONS = [
  { text: 'Say hello to a stranger', level: 2 },
  { text: 'Order food at a restaurant', level: 3 },
  { text: 'Answer a question in class', level: 4 },
  { text: 'Introduce myself to someone new', level: 5 },
  { text: 'Ask a teacher or boss for help', level: 5 },
  { text: 'Make a phone call', level: 6 },
  { text: 'Give a presentation', level: 8 },
  { text: 'Speak in a group meeting', level: 7 },
  { text: 'Job or school interview', level: 9 },
  { text: 'Speak on video call', level: 6 },
]

export default function BraveMissions() {
  const [view, setView] = useState('ladder') // ladder | mission | roleplay | celebrate
  const [ladder, setLadder] = useState([])
  const [activeMission, setActiveMission] = useState(null)
  const [newSituation, setNewSituation] = useState('')
  const [newLevel, setNewLevel] = useState(5)
  const [addingNew, setAddingNew] = useState(false)
  const [missionData, setMissionData] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voluntaryUsed, setVoluntaryUsed] = useState(false)
  const [stars, setStars] = useState(0)
  const chatRef = useRef(null)
  const navigate = useNavigate()
  const { triggerFlux, refreshProfile, profile } = useApp()
  const { fluxSay, fluxStop, fluxSpeaking } = useFluxVoice()

  useEffect(() => { loadLadder() }, [])

  const loadLadder = async () => {
    let items = await getFearLadder()
    if (items.length === 0) {
      // Seed with presets
      for (const p of PRESET_SITUATIONS.slice(0, 4)) {
        await addFearItem(p.text, p.level)
      }
      items = await getFearLadder()
    }
    setLadder(items)
  }

  const handleAddSituation = async () => {
    if (!newSituation.trim()) return
    await addFearItem(newSituation.trim(), newLevel)
    setNewSituation('')
    setNewLevel(5)
    setAddingNew(false)
    await loadLadder()
  }

  const handleAddPreset = async (p) => {
    await addFearItem(p.text, p.level)
    await loadLadder()
  }

  const startMission = async (item) => {
    setActiveMission(item)
    setView('mission')
    setLoading(true)
    try {
      const data = await generateBraveMission(item.fearLevel, item.situation, profile)
      setMissionData(data)
    } catch {
      setMissionData(getOfflineMission(item.fearLevel))
    }
    setLoading(false)
    setVoluntaryUsed(false)
    setStars(0)
    setChatHistory([])
  }

  const startRoleplay = () => {
    setView('roleplay')
    const intro = { role: 'flux', text: missionData.prompt, timestamp: Date.now() }
    setChatHistory([intro])
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', text: input.trim(), timestamp: Date.now() }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setInput('')
    setLoading(true)

    // Check for voluntary stutter mention
    const hasVoluntary = input.toLowerCase().includes('stutter') || input.includes('---') || input.includes('...')
    if (hasVoluntary && !voluntaryUsed) {
      setVoluntaryUsed(true)
      setStars(s => s + 3)
      setTimeout(() => {
        triggerFlux(getOfflineResponse('voluntary_stutter'))
      }, 500)
    } else {
      setStars(s => s + 1)
    }

    // Build AI messages
    const messages = newHistory
      .filter(m => m.role !== 'flux' || m !== newHistory[0])
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }))

    const systemAddition = `\nYou are playing the character: ${missionData?.character || 'a friendly person'}. 
Setup: ${missionData?.setup || ''}
Continue the roleplay warmly. Keep responses short (2-3 sentences). Be encouraging and natural.
After 4-5 exchanges, gently wrap up the scenario positively.`

    try {
      const result = await callFluxAI(messages, { ...profile, systemExtra: systemAddition })
      const fluxMsg = { role: 'flux', text: result.text, timestamp: Date.now() }
      setChatHistory(h => [...h, fluxMsg])
    } catch {
      const fallback = { role: 'flux', text: getOfflineResponse('brave_missions'), timestamp: Date.now() }
      setChatHistory(h => [...h, fallback])
    }
    setLoading(false)
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 100)
  }

  const completeMission = async () => {
    const totalStars = stars + 10 + (voluntaryUsed ? 5 : 0)
    await completeFearItem(activeMission.id)
    await addBraveStar('brave_mission', activeMission.situation)
    await addSession('brave', totalStars, { situation: activeMission.situation, voluntaryStutter: voluntaryUsed })
    await markTodayStreak()
    await refreshProfile()
    await loadLadder()
    setStars(totalStars)
    setView('celebrate')
  }

  const fearColor = (level) => {
    if (level <= 3) return 'text-jade bg-jade/10 border-spark-400/30'
    if (level <= 6) return 'text-amber bg-brave-400/10 border-brave-400/30'
    return 'text-red-400 bg-red-400/10 border-red-400/30'
  }

  return (
    <div className="min-h-full pb-24 page-enter">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => { setView('ladder'); navigate(view === 'ladder' ? -1 : undefined) }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white flex-1">BraveMissions</h1>
        <span className="text-2xl">🦁</span>
      </div>

      {/* Fear Ladder */}
      {view === 'ladder' && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-6">
            <Flux size={80} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating
              showMessage message={getOfflineResponse('brave_missions')} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-white/70 text-sm uppercase tracking-wider">Your Fear Ladder</h2>
            <button onClick={() => setAddingNew(true)} className="text-aqua text-sm font-display">+ Add</button>
          </div>

          {addingNew && (
            <div className="card mb-4 space-y-3">
              <input
                value={newSituation}
                onChange={e => setNewSituation(e.target.value)}
                placeholder="Describe a speaking situation..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-cyan-400"
              />
              <div>
                <label className="text-white/50 text-xs mb-1 block">Fear level: {newLevel}/10</label>
                <input type="range" min={1} max={10} value={newLevel} onChange={e => setNewLevel(+e.target.value)} className="w-full" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAddingNew(false)} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
                <button onClick={handleAddSituation} className="btn-aqua flex-1 text-sm py-2">Add to Ladder</button>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-6">
            {ladder.sort((a, b) => a.fearLevel - b.fearLevel).map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  item.completed
                    ? 'bg-jade/10 border-spark-400/20 opacity-60'
                    : `bg-white/5 border-white/10 hover:bg-white/8 cursor-pointer active:scale-[0.98]`
                }`}
                onClick={() => !item.completed && startMission(item)}
              >
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                  {item.fearLevel}
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-display">{item.situation}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full border w-fit mt-0.5 ${fearColor(item.fearLevel)}`}>
                    Fear {item.fearLevel}/10
                  </div>
                </div>
                {item.completed
                  ? <span className="text-jade text-lg">✓</span>
                  : <span className="text-white/30">→</span>}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h3 className="font-display text-sm text-white/50 mb-2 uppercase tracking-wider">Add from presets</h3>
            <div className="flex flex-wrap gap-2">
              {PRESET_SITUATIONS.map(p => (
                <button
                  key={p.text}
                  onClick={() => handleAddPreset(p)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 active:scale-95 transition-all"
                >
                  {p.text}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-brave-500/20">
            <p className="text-brave-300 text-sm">⭐ <strong>Brave Stars</strong> are awarded for attempting ANY mission. Stutter on purpose for TRIPLE stars. Every attempt makes fear smaller.</p>
          </div>
        </div>
      )}

      {/* Mission Brief */}
      {view === 'mission' && (
        <div className="px-5">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <Flux size={100} ageGroup={profile?.ageGroup || 'explorer'} mood="thinking" floating />
              <p className="text-white/50">Flux is preparing your mission...</p>
            </div>
          ) : missionData && (
            <div className="flex flex-col gap-5">
              <div className="card border border-brave-500/20">
                <div className="text-amber text-xs uppercase tracking-wider mb-1">Mission Brief</div>
                <h2 className="font-display text-xl font-bold text-white mb-3">{missionData.title}</h2>
                <p className="text-white/70 text-sm leading-relaxed">{missionData.setup}</p>
              </div>

              <div className="card">
                <div className="text-white/50 text-xs mb-1">You'll be speaking with:</div>
                <div className="font-display font-semibold text-white">{missionData.character}</div>
              </div>

              {missionData.tips && (
                <div className="card bg-cyan-500/10 border-cyan-500/20">
                  <div className="text-aqua text-xs mb-2">💡 Tips</div>
                  {missionData.tips.map((t, i) => (
                    <div key={i} className="text-white/70 text-sm">• {t}</div>
                  ))}
                </div>
              )}

              {missionData.braveBonus && (
                <div className="card bg-amber-500/10 border-brave-500/20">
                  <div className="text-amber text-xs mb-1">⭐ BRAVE BONUS</div>
                  <div className="text-white/80 text-sm">{missionData.braveBonus}</div>
                </div>
              )}

              <button onClick={startRoleplay} className="btn-amber w-full text-lg py-4">
                Start Mission 🦁
              </button>
              <button onClick={() => setView('ladder')} className="btn-ghost w-full text-sm py-2">
                Choose Different Mission
              </button>
            </div>
          )}
        </div>
      )}

      {/* Roleplay Chat */}
      {view === 'roleplay' && (
        <div className="flex flex-col h-[calc(100vh-140px)]">
          {/* Stars counter */}
          <div className="flex items-center justify-between px-5 py-2">
            <span className="text-white/50 text-sm">{missionData?.title}</span>
            <span className="text-jade font-bold">⭐ {stars}</span>
          </div>

          {/* Chat */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-5 space-y-3 scrollbar-hide py-2">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'flux' && (
                  <div className="flex-shrink-0">
                    <Flux size={36} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-500 text-white rounded-tr-sm'
                    : 'glass text-white/90 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <Flux size={36} ageGroup={profile?.ageGroup || 'explorer'} mood="thinking" />
                <div className="glass rounded-2xl px-4 py-3 flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-5 py-3 glass-dark">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type your response..."
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none border border-white/10 focus:border-cyan-400"
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()}
                className="btn-aqua px-4 py-3 text-sm disabled:opacity-50">
                →
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setInput(prev => prev + ' [stutter]')}
                className="text-xs px-3 py-1.5 rounded-full bg-amber-500/20 border border-brave-500/30 text-brave-300 active:scale-95">
                ⭐ Add Voluntary Stutter (+3 stars)
              </button>
              <button onClick={completeMission}
                className="text-xs px-3 py-1.5 rounded-full bg-spark-500/20 border border-spark-500/30 text-spark-300 active:scale-95">
                Complete Mission ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebrate */}
      {view === 'celebrate' && (
        <div className="flex flex-col items-center px-5 py-8 gap-6 text-center">
          <Flux size={130} ageGroup={profile?.ageGroup || 'explorer'} mood="excited" floating />
          <div>
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="font-display text-3xl font-bold text-white mb-2">BRAVE!</h2>
            <p className="text-white/70 text-lg">You attempted "{activeMission?.situation}"</p>
            {voluntaryUsed && (
              <div className="mt-3 p-3 rounded-2xl bg-amber-500/20 border border-brave-500/30">
                <p className="text-brave-300 font-bold">⭐⭐⭐ VOLUNTARY STUTTER BONUS!</p>
                <p className="text-white/60 text-sm">That's the most powerful technique in speech therapy. You just did elite-level work.</p>
              </div>
            )}
            <div className="mt-4 font-display text-4xl font-bold text-jade">+{stars} ⭐</div>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => setView('ladder')} className="btn-ghost flex-1">More Missions</button>
            <button onClick={() => navigate('/home')} className="btn-aqua flex-1">Back Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
