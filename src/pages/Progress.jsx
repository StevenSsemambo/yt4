import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTotalSessions, getStreakCount, db } from '../utils/db'
import { loadMemory, MemoryKeys } from '../ai/fluxEngine'
import { useApp } from '../hooks/useAppContext'
import useFluxVoice from '../hooks/useFluxVoice'
import Flux from '../components/flux/Flux'

const ACHIEVEMENTS = [
  { id: 'first_session',  title: 'First Drop',      desc: 'Complete your first session',    icon: '💧', req: 1,   type: 'sessions' },
  { id: 'five_sessions',  title: 'Finding Flow',    desc: '5 sessions complete',            icon: '🌊', req: 5,   type: 'sessions' },
  { id: 'twenty',         title: 'Flow State',      desc: '20 sessions',                    icon: '🏄', req: 20,  type: 'sessions' },
  { id: 'fifty',          title: 'River Force',     desc: '50 sessions',                    icon: '🌍', req: 50,  type: 'sessions' },
  { id: 'hundred',        title: 'Century Wave',    desc: '100 sessions — legendary',       icon: '👑', req: 100, type: 'sessions' },
  { id: 'first_brave',    title: 'Brave Spark',     desc: 'First BraveMission',             icon: '🦁', req: 1,   type: 'brave' },
  { id: 'five_brave',     title: 'Fear Shrinker',   desc: '5 BraveMissions done',           icon: '🔥', req: 5,   type: 'brave' },
  { id: 'voluntary',      title: 'Stutter Warrior', desc: 'First voluntary stutter',        icon: '⭐', req: 1,   type: 'voluntary' },
  { id: 'streak_3',       title: '3-Day Flow',      desc: '3 day streak',                   icon: '📅', req: 3,   type: 'streak' },
  { id: 'streak_7',       title: 'Week Warrior',    desc: '7 day streak',                   icon: '🗓️', req: 7,   type: 'streak' },
  { id: 'streak_30',      title: 'Month of Courage',desc: '30 day streak',                  icon: '🏆', req: 30,  type: 'streak' },
  { id: 'journal',        title: 'Voice Recorded',  desc: 'First journal entry',            icon: '🎙️', req: 1,   type: 'journal' },
  { id: 'story',          title: 'Story Starter',   desc: 'First TalkTales complete',       icon: '📖', req: 1,   type: 'story' },
  { id: 'breathe_10',     title: 'Breath Master',   desc: '10 breathing sessions',          icon: '💨', req: 10,  type: 'breathe' },
  { id: 'comm_5',         title: 'Comm Champion',   desc: '5 comm sessions',                icon: '🎙️', req: 5,   type: 'comm' },
]

const EVOLUTIONS = [
  { sessions: 0,   name: 'Water Drop',  color: '#22d3ee', size: 80  },
  { sessions: 5,   name: 'Stream',      color: '#0ea5e9', size: 90  },
  { sessions: 20,  name: 'River',       color: '#7c3aed', size: 100 },
  { sessions: 50,  name: 'Ocean Wave',  color: '#f97316', size: 110 },
  { sessions: 100, name: 'Full Flow',   color: '#fbbf24', size: 120 },
]

function StarSky({ sessionCount }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const total = Math.min(sessionCount * 4 + 8, 300)

    const stars = Array.from({ length: total }, (_, i) => {
      const angle = i * 2.399963 // golden angle
      const radius = Math.sqrt(i / total) * Math.min(W, H) * 0.46
      return {
        x: W / 2 + Math.cos(angle) * radius,
        y: H / 2 + Math.sin(angle) * radius,
        r: Math.random() * 1.8 + 0.4,
        hue: 180 + Math.sin(i * 0.3) * 50,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02,
      }
    })

    let frame = 0
    let animId

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      frame++

      // Draw constellation lines
      if (sessionCount >= 5) {
        ctx.strokeStyle = 'rgba(34,211,238,0.08)'
        ctx.lineWidth = 0.6
        for (let i = 0; i < Math.min(stars.length - 1, 40); i += 3) {
          ctx.beginPath()
          ctx.moveTo(stars[i].x, stars[i].y)
          ctx.lineTo(stars[i + 1].x, stars[i + 1].y)
          ctx.stroke()
        }
      }

      stars.forEach((s, i) => {
        const twinkle = Math.sin(s.twinkle + frame * s.speed) * 0.4 + 0.6
        const isNew = i >= total - 4

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * (isNew ? 1.5 : 1), 0, Math.PI * 2)

        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3)
        grd.addColorStop(0, `hsla(${s.hue}, 80%, 85%, ${twinkle})`)
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.fill()
      })

      // Center glow (Flux position)
      const grd2 = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 40)
      grd2.addColorStop(0, 'rgba(34,211,238,0.12)')
      grd2.addColorStop(1, 'transparent')
      ctx.fillStyle = grd2
      ctx.fillRect(0, 0, W, H)

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [sessionCount])

  return (
    <canvas ref={canvasRef} width={320} height={260}
      className="rounded-3xl w-full" style={{ maxWidth: '320px' }} />
  )
}

export default function Progress() {
  const [stats, setStats]     = useState({ sessions:0, streak:0, brave:0, voluntary:0, journal:0, story:0, breathe:0, comm:0 })
  const [unlocked, setUnlocked] = useState([])
  const [evolution, setEvolution] = useState(EVOLUTIONS[0])
  const [nextEvo, setNextEvo]   = useState(EVOLUTIONS[1])
  const [insights, setInsights] = useState([])
  const [strengths, setStrengths] = useState([])
  const [tab, setTab]           = useState('sky')
  const { profile }             = useApp()
  const { fluxSay }             = useFluxVoice()
  const navigate                = useNavigate()

  useEffect(() => {
    const load = async () => {
      const sessions  = await getTotalSessions()
      const streak    = await getStreakCount()
      const brave     = await db.sessions.where('type').equals('brave').count()
      const voluntary = await db.braveStars.count().catch(() => 0)
      const journal   = await db.journal.count()
      const story     = await db.sessions.where('type').equals('talktales').count()
      const breathe   = await db.sessions.where('type').equals('breathe').count()
      const comm      = await db.sessions.filter(s => s.type?.startsWith('comm_')).count()

      const s = { sessions, streak, brave, voluntary, journal, story, breathe, comm }
      setStats(s)

      const evo  = [...EVOLUTIONS].reverse().find(e => sessions >= e.sessions) || EVOLUTIONS[0]
      const next = EVOLUTIONS.find(e => e.sessions > sessions) || null
      setEvolution(evo); setNextEvo(next)

      setUnlocked(ACHIEVEMENTS.filter(a => (s[a.type] || 0) >= a.req))

      const ins = await loadMemory(MemoryKeys.INSIGHTS, [])
      const str = await loadMemory(MemoryKeys.STRENGTHS, [])
      setInsights(ins.slice(-6))
      setStrengths(str.slice(-6))
    }
    load()
  }, [])

  const evoProgress = nextEvo
    ? Math.min((stats.sessions - evolution.sessions) / (nextEvo.sessions - evolution.sessions) * 100, 100)
    : 100

  const TABS = [
    { id: 'sky',          label: '🌌 My Sky' },
    { id: 'achievements', label: '🏆 Badges' },
    { id: 'insights',     label: '🧠 Insights' },
    { id: 'flux',         label: '💧 Flux' },
  ]

  return (
    <div className="min-h-full pb-28 page-enter" style={{ zIndex: 1 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-white">Progress Universe</h1>
          <p className="text-white/35 text-xs">{stats.sessions} sessions · {unlocked.length} badges earned</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-5 mb-5 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all"
            style={tab === t.id
              ? { background: 'var(--aqua)', color: '#05080f' }
              : { color: 'rgba(255,255,255,0.4)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sky Tab ── */}
      {tab === 'sky' && (
        <div className="px-5 flex flex-col gap-5">
          <div className="flex flex-col items-center">
            <p className="text-white/35 text-xs mb-3 text-center">Every session adds a star to your sky</p>
            <StarSky sessionCount={stats.sessions} />
            <p className="text-white/25 text-xs mt-2">{stats.sessions} stars · {unlocked.length} constellations formed</p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { v: stats.sessions,     l: 'Sessions', c: 'var(--aqua)',   i: '🎯' },
              { v: `${stats.streak}🔥`, l: 'Streak',   c: 'var(--amber)',  i: '📅' },
              { v: stats.sessions*15,  l: 'Stars',    c: 'var(--jade)',   i: '⭐' },
              { v: stats.brave,        l: 'Missions', c: 'var(--amber)',  i: '🦁' },
              { v: stats.journal,      l: 'Journals', c: 'var(--violet)', i: '🎙️' },
              { v: stats.comm,         l: 'Comm',     c: 'var(--rose)',   i: '🎙️' },
            ].map((s, i) => (
              <div key={i} className="card text-center py-4 animate-scale-in" style={{ animationDelay: `${i*0.06}s` }}>
                <div className="text-xl mb-0.5">{s.i}</div>
                <div className="font-display font-bold text-xl" style={{ color: s.c }}>{s.v}</div>
                <div className="text-white/30 text-xs mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Flux evolution progress */}
          <div className="card-lg">
            <div className="flex items-center gap-4 mb-4">
              <Flux size={56} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" />
              <div className="flex-1">
                <div className="font-display font-bold text-white">{evolution.name}</div>
                <div className="text-white/40 text-xs">Flux evolution · {stats.sessions} sessions</div>
              </div>
              <div className="pill-aqua text-xs">Lvl {EVOLUTIONS.indexOf(evolution) + 1}</div>
            </div>
            {nextEvo ? (
              <>
                <div className="prog-track mb-2">
                  <div className="prog-fill" style={{ width: `${evoProgress}%`, background: 'linear-gradient(90deg, var(--aqua), var(--violet))' }}/>
                </div>
                <p className="text-white/30 text-xs">{stats.sessions}/{nextEvo.sessions} to unlock "{nextEvo.name}"</p>
              </>
            ) : (
              <p className="text-jade text-xs font-display" style={{ color: 'var(--jade)' }}>✓ Maximum evolution reached — Full Flow!</p>
            )}
          </div>
        </div>
      )}

      {/* ── Achievements Tab ── */}
      {tab === 'achievements' && (
        <div className="px-5">
          <p className="text-white/35 text-xs mb-4">{unlocked.length}/{ACHIEVEMENTS.length} badges earned</p>
          <div className="grid grid-cols-3 gap-2.5">
            {ACHIEVEMENTS.map((a, i) => {
              const earned = unlocked.some(u => u.id === a.id)
              return (
                <div key={a.id}
                  className="flex flex-col items-center p-3 rounded-2xl border text-center transition-all animate-scale-in"
                  style={{
                    animationDelay: `${i * 0.04}s`,
                    background: earned ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)',
                    borderColor: earned ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.07)',
                    opacity: earned ? 1 : 0.4,
                  }}>
                  <div className="text-2xl mb-1" style={{ filter: earned ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
                  <div className="font-display text-xs font-bold text-white leading-tight">{a.title}</div>
                  <div className="text-white/35 text-[10px] mt-0.5 leading-tight">{a.desc}</div>
                  {earned && <div className="mt-1.5 text-[10px] font-display font-semibold" style={{ color: 'var(--jade)' }}>✓ Earned</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Insights Tab ── */}
      {tab === 'insights' && (
        <div className="px-5 flex flex-col gap-4">
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(34,211,238,0.12)' }}>🧠</div>
              <div>
                <div className="font-display font-semibold text-white text-sm">What Flux has learned about you</div>
                <div className="text-white/35 text-xs">Updates after every session</div>
              </div>
            </div>

            {insights.length > 0 ? (
              <div className="space-y-2.5">
                {insights.map((ins, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'var(--aqua)' }} className="text-sm flex-shrink-0">💡</span>
                    <p className="text-white/70 text-sm leading-relaxed">{ins.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/35 text-sm text-center py-4">
                Complete more sessions and Flux will start building insights about your unique journey.
              </p>
            )}
          </div>

          {strengths.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(52,211,153,0.2)' }}>
              <div className="section-label mb-3" style={{ color: 'var(--jade)' }}>Your Strengths</div>
              <div className="flex flex-wrap gap-2">
                {strengths.map((s, i) => (
                  <span key={i} className="pill-jade animate-scale-in" style={{ animationDelay: `${i*0.05}s` }}>
                    ✓ {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.sessions === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-white/35 text-sm">Start practicing and Flux will learn what makes you unique and build personalized insights just for you.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Flux Tab ── */}
      {tab === 'flux' && (
        <div className="px-5 flex flex-col items-center gap-5">
          <div className="animate-flux-float">
            <Flux size={evolution.size} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" />
          </div>
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-white">{evolution.name}</h2>
            <p className="text-white/40 text-sm mt-1">Session {stats.sessions} of your journey</p>
          </div>

          <div className="w-full space-y-2">
            <p className="section-label mb-2">Evolution Path</p>
            {EVOLUTIONS.map((evo, i) => {
              const reached = stats.sessions >= evo.sessions
              return (
                <div key={i}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border transition-all animate-slide-up"
                  style={{
                    animationDelay: `${i*0.07}s`,
                    background: reached ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.03)',
                    borderColor: reached ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.07)',
                    opacity: reached ? 1 : 0.45,
                  }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                       style={{ background: reached ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)', color: reached ? 'var(--aqua)' : 'rgba(255,255,255,0.4)' }}>
                    {reached ? '✓' : evo.sessions}
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-semibold text-white text-sm">{evo.name}</div>
                    <div className="text-white/35 text-xs">{evo.sessions} sessions</div>
                  </div>
                  {evolution.sessions === evo.sessions && (
                    <span className="pill-aqua text-[10px]">Current</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
