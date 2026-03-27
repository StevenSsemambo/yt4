import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useAppContext'
import Flux from '../components/flux/Flux'
import { getOfflineResponse, detectContext, getPersonalizedRecommendation } from '../ai/fluxEngine'
import { getTotalSessions, getStreakCount, getRecentSessions } from '../utils/db'
import useFluxVoice from '../hooks/useFluxVoice'

const MODE_CONFIG = {
  stutter: {
    label: 'Stutter Confidence',
    icon: '💧',
    color: 'var(--aqua)',
    glow: 'rgba(34,211,238,0.2)',
    grad: 'from-cyan-500/20 to-sky-600/20',
    border: 'border-cyan-500/25',
  },
  comm: {
    label: 'Communication Coach',
    icon: '🎙️',
    color: 'var(--violet)',
    glow: 'rgba(167,139,250,0.2)',
    grad: 'from-violet-500/20 to-purple-600/20',
    border: 'border-violet-500/25',
  }
}

const QUICK_ACTIONS = [
  { id: 'breathe',     label: 'Breathe',      icon: '💨', path: '/breathe',      color: 'from-sky-500/15 to-cyan-500/15',     border: 'border-sky-500/20',    pill: 'pill-aqua',   time: '2 min' },
  { id: 'speaklab',    label: 'SpeakLab',     icon: '🗣️', path: '/speaklab',     color: 'from-violet-500/15 to-purple-500/15', border: 'border-violet-500/20', pill: 'pill-violet', time: '5 min' },
  { id: 'brave',       label: 'BraveMissions', icon: '🦁', path: '/brave',        color: 'from-amber-500/15 to-orange-500/15', border: 'border-amber-500/20',  pill: 'pill-amber',  time: 'Daily' },
  { id: 'journal',     label: 'Journal',       icon: '🎙️', path: '/journal',      color: 'from-jade-500/15 to-emerald-500/15', border: 'border-jade-500/20',   pill: 'pill-jade',   time: '30 sec' },
  { id: 'fluentpath',  label: 'FluentPath',    icon: '🗺️', path: '/fluentpath',   color: 'from-cyan-500/15 to-teal-500/15',    border: 'border-cyan-500/20',   pill: 'pill-aqua',   time: '10 min' },
  { id: 'mindshift',   label: 'MindShift',     icon: '🧠', path: '/mindshift',    color: 'from-violet-500/15 to-indigo-500/15', border: 'border-violet-500/20', pill: 'pill-violet', time: 'CBT' },
  { id: 'stutterscore',label: 'StutterScore',  icon: '📊', path: '/stutterscore', color: 'from-rose-500/15 to-pink-500/15',    border: 'border-rose-500/20',   pill: 'pill-rose',   time: 'Weekly' },
  { id: 'neurobrain',  label: 'NeuroBrain',    icon: '⚡', path: '/neurobrain',   color: 'from-amber-500/15 to-yellow-500/15', border: 'border-amber-500/20',  pill: 'pill-amber',  time: 'Learn' },
  { id: 'voicelab',    label: 'Voice Lab',     icon: '🎵', path: '/voicelab',     color: 'from-cyan-500/15 to-sky-500/15',     border: 'border-cyan-500/20',   pill: 'pill-aqua',   time: '6 skills' },
]

export default function Home() {
  const { profile, refreshProfile } = useApp()
  const [sessions, setSessions]   = useState(0)
  const [streak, setStreak]       = useState(0)
  const [recent, setRecent]       = useState([])
  const [fluxMsg, setFluxMsg]     = useState('')
  const [aiRec, setAiRec]         = useState('')
  const [loadingRec, setLoadingRec] = useState(false)
  const [mode, setMode]           = useState(profile?.mode || 'stutter')
  const { fluxSay, fluxSpeaking } = useFluxVoice()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const [s, str, r] = await Promise.all([
        getTotalSessions(), getStreakCount(), getRecentSessions(3)
      ])
      setSessions(s); setStreak(str); setRecent(r)
      const ctx = detectContext({ streakDays: str, sessionCount: s })
      const msg = getOfflineResponse(ctx, profile?.name)
      setFluxMsg(msg)

      // Get AI personalized recommendation
      setLoadingRec(true)
      try {
        const rec = await getPersonalizedRecommendation(profile)
        setAiRec(rec)
      } catch { setAiRec('') }
      setLoadingRec(false)
    }
    load()
  }, [profile])  // Bug 3 fix: re-run when profile loads so recommendation is personalised

  const modeConf  = MODE_CONFIG[mode] || MODE_CONFIG.stutter
  const greeting  = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()
  const userName  = profile?.name || 'friend'
  const ageGroup  = profile?.ageGroup || 'explorer'

  const tapFlux = () => {
    const m = getOfflineResponse('encouragement', profile?.name)
    setFluxMsg(m)
    fluxSay(m, true)
  }

  return (
    <div className="relative min-h-full pb-28 overflow-x-hidden" style={{ zIndex: 1 }}>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-8 pb-3 flex items-center justify-between animate-slide-down">
        <div>
          <p className="text-white/35 text-xs font-body">{greeting}</p>
          <h1 className="text-2xl font-display font-bold text-white leading-tight">{userName} <span className="text-white/40">👋</span></h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode pill */}
          <button
            onClick={() => {
              const next = mode === 'stutter' ? 'comm' : 'stutter'
              setMode(next)
            }}
            className="pill text-xs transition-all active:scale-95"
            style={{ background: `${modeConf.glow}`, borderColor: modeConf.color, color: modeConf.color, border: `1px solid ${modeConf.color}40` }}
          >
            {modeConf.icon} {modeConf.label}
          </button>

          {/* Avatar */}
          <button onClick={() => navigate('/progress')}
            className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm relative"
            style={{ background: `linear-gradient(135deg, var(--aqua), var(--violet))` }}>
            <span style={{ color: '#05080f' }}>{userName.charAt(0).toUpperCase()}</span>
            {streak > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber text-ink text-[9px] font-bold flex items-center justify-center">
                {streak > 9 ? '9+' : streak}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Flux Hero ────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center px-5 py-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {/* Flux with orbiting rings */}
        <div className="relative mb-4 cursor-pointer" onClick={tapFlux}>
          {/* Outer ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-36 rounded-full border border-aqua/10 animate-pulse-ring" style={{ animationDuration: '3s' }}/>
          </div>
          <div className="animate-flux-float" style={{ filter: fluxSpeaking ? 'drop-shadow(0 0 20px var(--aqua))' : 'drop-shadow(0 0 10px rgba(34,211,238,0.3))' }}>
            <Flux size={110} ageGroup={ageGroup} mood={fluxSpeaking ? 'excited' : 'happy'} speaking={fluxSpeaking} />
          </div>
        </div>

        {/* Flux message */}
        {fluxMsg && (
          <div className="max-w-[280px] text-center animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <p className="text-white/70 text-sm leading-relaxed glass rounded-2xl px-4 py-3">{fluxMsg}</p>
          </div>
        )}
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 px-5 mb-5 animate-slide-up stagger-2">
        {[
          { val: sessions,                      label: 'Sessions',    icon: '🎯', color: 'text-aqua' },
          { val: `${streak}🔥`,                  label: 'Day Streak',  icon: '📅', color: 'text-amber' },
          { val: `${sessions * 15}`,             label: 'Stars',       icon: '⭐', color: 'text-jade' },
        ].map((s, i) => (
          <div key={i} className="card text-center py-4">
            <div className={`font-display font-bold text-xl ${s.color}`}>{s.val}</div>
            <div className="text-white/35 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── AI Recommendation ───────────────────────────────────────────── */}
      {(aiRec || loadingRec) && (
        <div className="mx-5 mb-5 animate-slide-up stagger-3">
          <div className="card border-aqua/15 relative overflow-hidden" style={{ borderColor: 'rgba(34,211,238,0.15)' }}>
            <div className="absolute inset-0 animate-shimmer pointer-events-none" />
            <div className="relative flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-sm"
                   style={{ background: 'rgba(34,211,238,0.15)' }}>🧠</div>
              <div>
                <div className="section-label mb-1">Flux recommends</div>
                {loadingRec
                  ? <div className="flex gap-1 py-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-white/20 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
                  : <p className="text-white/80 text-sm leading-relaxed">{aiRec}</p>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero Adventure Card ─────────────────────────────────────────── */}
      <div className="px-5 mb-5 animate-slide-up stagger-3">
        <button
          onClick={() => navigate(mode === 'stutter' ? '/adventure' : '/comm')}
          className="w-full relative overflow-hidden rounded-3xl p-5 active:scale-[0.98] transition-transform text-left"
          style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          {/* Glow orb */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.25), transparent 70%)' }}/>
          <div className="relative">
            <div className="section-label mb-1">Today's Path</div>
            <h2 className="font-display font-bold text-white text-xl leading-tight mb-0.5">
              {mode === 'stutter' ? 'Adventure Mode' : 'Comm Academy'}
            </h2>
            <p className="text-white/50 text-sm mb-3">
              {mode === 'stutter' ? '6 zones · 30 missions · Your flow awaits' : 'Presentations · Interviews · Real-world speaking'}
            </p>
            <div className="prog-track mb-1">
              <div className="prog-fill" style={{ width: `${Math.min((sessions % 5) * 20, 100)}%`, background: 'linear-gradient(90deg, var(--aqua), var(--violet))' }}/>
            </div>
            <p className="text-white/30 text-xs">{sessions % 5}/5 sessions this cycle</p>
          </div>
          <div className="absolute bottom-4 right-4 text-3xl">{mode === 'stutter' ? '🗺️' : '🎙️'}</div>
        </button>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <p className="section-label mb-3">Quick Practice</p>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK_ACTIONS.map((a, i) => (
            <button
              key={a.id}
              onClick={() => navigate(a.path)}
              className={`relative p-4 rounded-2xl border bg-gradient-to-br ${a.color} ${a.border} text-left active:scale-95 transition-all duration-150 animate-slide-up`}
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
            >
              <div className="text-2xl mb-2">{a.icon}</div>
              <div className="font-display font-semibold text-white text-sm">{a.label}</div>
              <div className={`${a.pill} mt-1.5 text-[10px]`}>{a.time}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Feature Row ─────────────────────────────────────────────────── */}
      <div className="px-5 mb-5 space-y-2.5">
        {[
          { icon: '📖', label: 'TalkTales', desc: 'Tell a story with Flux · no pressure', path: '/talktales', color: 'var(--violet)' },
          { icon: '👨‍👩‍👧', label: 'Family Mode', desc: 'Co-read for up to 97% fluency boost', path: '/family', color: 'var(--jade)' },
          { icon: '💬', label: 'Talk to Flux', desc: 'Voice conversation · always listening', path: '/flux-chat', color: 'var(--aqua)' },
        ].map((f, i) => (
          <button key={i} onClick={() => navigate(f.path)}
            className="w-full card flex items-center gap-4 active:scale-[0.98] transition-transform text-left">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                 style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>{f.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-white text-sm">{f.label}</div>
              <div className="text-white/35 text-xs truncate">{f.desc}</div>
            </div>
            <svg className="w-4 h-4 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        ))}
      </div>

      {/* ── Recent Activity ─────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div className="px-5">
          <p className="section-label mb-3">Recent Activity</p>
          <div className="space-y-2">
            {recent.map((s, i) => (
              <div key={i} className="card flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl glass-2 flex items-center justify-center text-base flex-shrink-0">
                  {s.type==='breathe'?'💨':s.type==='speaklab'?'🗣️':s.type==='brave'?'🦁':s.type==='talktales'?'📖':'🎙️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-display capitalize truncate">{s.type||'Session'}</div>
                  <div className="text-white/30 text-xs">{new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                </div>
                <span className="text-jade text-sm font-bold flex-shrink-0">+{s.score||10}⭐</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
