import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak, getSetting, setSetting } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const DOMAINS = [
  { id: 'communication', label: 'Communication', icon: '🗣️', color: 'var(--aqua)', desc: 'How much does stuttering interfere with your ability to say what you want to say?' },
  { id: 'daily', label: 'Daily Activities', icon: '📅', color: 'var(--jade)', desc: 'How much does stuttering affect everyday tasks like shopping, ordering food, or making calls?' },
  { id: 'social', label: 'Social Life', icon: '👥', color: 'var(--violet)', desc: 'How much does stuttering affect your social interactions and relationships?' },
  { id: 'work', label: 'Work / School', icon: '💼', color: 'var(--amber)', desc: 'How much does stuttering affect your performance or participation at work or school?' },
  { id: 'emotion', label: 'Emotions', icon: '💙', color: 'var(--rose)', desc: 'How much emotional distress (anxiety, shame, frustration) does stuttering cause you?' },
]

const SCALE_LABELS = ['No impact', 'Very mild', 'Mild', 'Moderate', 'Moderately severe', 'Severe', 'Very severe', 'Profound', 'Complete impact']

function RadarChart({ scores }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2
    const r = Math.min(W, H) * 0.38
    const n = DOMAINS.length
    ctx.clearRect(0, 0, W, H)

    // Grid rings
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(angle) * r * (ring / 4)
        const y = cy + Math.sin(angle) * r * (ring / 4)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // Spokes
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // Data polygon
    const vals = DOMAINS.map(d => (scores[d.id] || 0) / 8)
    ctx.beginPath()
    vals.forEach((v, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      const x = cx + Math.cos(angle) * r * v
      const y = cy + Math.sin(angle) * r * v
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(34,211,238,0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(34,211,238,0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Labels
    DOMAINS.forEach((d, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      const lx = cx + Math.cos(angle) * (r + 20)
      const ly = cy + Math.sin(angle) * (r + 20)
      ctx.font = '10px DM Sans'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(d.icon + ' ' + d.label, lx, ly)
    })
  }, [scores])

  return <canvas ref={canvasRef} width={260} height={260} className="mx-auto" />
}

function TrendLine({ history, domain }) {
  if (history.length < 2) return null
  const last7 = history.slice(-7)
  const max = 8
  const w = 200, h = 40
  const pts = last7.map((entry, i) => ({
    x: (i / (last7.length - 1)) * w,
    y: h - ((entry.scores?.[domain] || 0) / max) * h,
  }))
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const color = DOMAINS.find(d => d.id === domain)?.color || 'var(--aqua)'
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.9" />)}
    </svg>
  )
}

export default function StutterScore() {
  const [view, setView] = useState('rate') // rate | history | insights
  const [scores, setScores] = useState({})
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fluxMsg, setFluxMsg] = useState(getOfflineResponse('encouragement'))
  const navigate = useNavigate()
  const { profile, refreshProfile, triggerFlux } = useApp()
  const { fluxSay } = useFluxVoice()
  const ag = profile?.ageGroup || 'explorer'

  useEffect(() => {
    getSetting('stutterscore_history', []).then(h => setHistory(Array.isArray(h) ? h : []))
  }, [])

  const overallScore = DOMAINS.length
    ? Math.round(DOMAINS.reduce((sum, d) => sum + (scores[d.id] || 0), 0) / DOMAINS.length)
    : 0

  const prevEntry = history.length ? history[history.length - 1] : null
  const prevOverall = prevEntry
    ? Math.round(DOMAINS.reduce((sum, d) => sum + (prevEntry.scores?.[d.id] || 0), 0) / DOMAINS.length)
    : null

  const trend = prevOverall !== null ? overallScore - prevOverall : 0

  const getInsight = () => {
    const worst = DOMAINS.reduce((a, b) => (scores[a.id] || 0) > (scores[b.id] || 0) ? a : b)
    const best = DOMAINS.reduce((a, b) => (scores[a.id] || 0) < (scores[b.id] || 0) ? a : b)
    if (overallScore <= 2) return { text: "Your scores this week are low — you're managing really well. Keep doing what you're doing.", type: 'success' }
    if (overallScore >= 6) return { text: `Your scores are high this week. The ${worst.label} domain is taking the most impact. Consider focusing extra practice there.`, type: 'warning' }
    return { text: `${best.label} is your strongest area right now. ${worst.label} has the most room to grow — that's where extra practice will have the most impact.`, type: 'info' }
  }

  const handleSave = async () => {
    if (Object.keys(scores).length < DOMAINS.length) return
    setSaving(true)
    const entry = { scores, date: new Date().toISOString(), overall: overallScore }
    const existing = await getSetting('stutterscore_history', [])
    const updated = [...(Array.isArray(existing) ? existing : []), entry].slice(-52)
    await setSetting('stutterscore_history', updated)
    setHistory(updated)
    await addSession('stutterscore', Math.max(0, 100 - overallScore * 12), { scores })
    await markTodayStreak()
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    const msg = trend <= 0 && prevOverall !== null
      ? `Your scores ${trend < 0 ? 'improved' : 'held steady'} this week. That's real progress worth tracking.`
      : getOfflineResponse('encouragement')
    setFluxMsg(msg)
    fluxSay(msg)
    triggerFlux(msg)
    setTimeout(() => { setSaved(false); setView('history') }, 1800)
  }

  const insight = Object.keys(scores).length === DOMAINS.length ? getInsight() : null

  return (
    <div className="relative min-h-full pb-28" style={{ zIndex: 1 }}>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(-1)} className="w-9 h-9 glass rounded-xl flex items-center justify-center text-white/60">←</button>
          <div>
            <h1 className="text-xl font-bold font-display text-white">StutterScore</h1>
            <p className="text-xs text-white/40">Weekly impact tracker</p>
          </div>
        </div>
      </div>

      {/* Flux */}
      <div className="px-4 mb-4">
        <div className="card flex items-start gap-3">
          <div className="animate-flux-float flex-shrink-0">
            <Flux size={44} ageGroup={ag} mood="thinking" />
          </div>
          <p className="text-white/80 text-sm leading-relaxed">{fluxMsg}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 mb-5 flex gap-2">
        {['rate', 'history', 'insights'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold font-display transition-all ${view === v ? 'text-[#05080f]' : 'glass text-white/50'}`}
            style={view === v ? { background: 'var(--aqua)' } : {}}>
            {v === 'rate' ? '📊 Rate' : v === 'history' ? '📅 History' : '💡 Insights'}
          </button>
        ))}
      </div>

      {/* ── RATE VIEW ── */}
      {view === 'rate' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card">
            <p className="text-white/70 text-sm leading-relaxed">
              Rate how much stuttering has impacted each area of your life <span className="text-white/40">this week</span>. 0 = no impact, 8 = complete impact.
            </p>
          </div>

          {DOMAINS.map(domain => (
            <div key={domain.id} className="card-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{domain.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{domain.label}</p>
                  <p className="text-white/40 text-xs">{domain.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="8" step="1"
                  value={scores[domain.id] ?? 4}
                  onChange={e => setScores(prev => ({ ...prev, [domain.id]: Number(e.target.value) }))}
                  className="flex-1" />
                <span className="text-white font-bold text-lg w-6 text-center" style={{ color: domain.color }}>
                  {scores[domain.id] ?? '–'}
                </span>
              </div>
              {scores[domain.id] !== undefined && (
                <p className="text-white/40 text-xs">{SCALE_LABELS[scores[domain.id]]}</p>
              )}
            </div>
          ))}

          {/* Overall + radar */}
          {Object.keys(scores).length === DOMAINS.length && (
            <div className="card-lg text-center animate-scale-in space-y-3">
              <p className="text-white/50 text-xs">Overall impact score</p>
              <div className="text-5xl font-bold font-display" style={{ color: overallScore <= 2 ? 'var(--jade)' : overallScore <= 5 ? 'var(--amber)' : 'var(--rose)' }}>
                {overallScore}<span className="text-2xl text-white/30">/8</span>
              </div>
              {prevOverall !== null && (
                <p className={`text-sm font-semibold ${trend < 0 ? 'text-jade' : trend > 0 ? 'text-rose' : 'text-white/40'}`}>
                  {trend < 0 ? `↓ ${Math.abs(trend)} better than last week` : trend > 0 ? `↑ ${trend} higher than last week` : '→ Same as last week'}
                </p>
              )}
              <RadarChart scores={scores} />
            </div>
          )}

          {insight && (
            <div className={`glass rounded-2xl p-4 border ${insight.type === 'success' ? 'border-jade/20' : insight.type === 'warning' ? 'border-amber/20' : 'border-aqua/20'}`}>
              <p className="text-white/70 text-sm leading-relaxed">{insight.text}</p>
            </div>
          )}

          <button onClick={handleSave}
            disabled={Object.keys(scores).length < DOMAINS.length || saving || saved}
            className="w-full btn-aqua py-4 text-sm disabled:opacity-40">
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save This Week\'s Score'}
          </button>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === 'history' && (
        <div className="px-4 space-y-4 animate-fade-in">
          {history.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-3">📅</div>
              <p className="text-white/50 text-sm">Complete your first weekly rating to see your history here.</p>
            </div>
          ) : (
            <>
              {/* Trend charts per domain */}
              <div className="card-lg space-y-4">
                <p className="text-white/70 text-sm font-semibold">Trends over time</p>
                {DOMAINS.map(domain => (
                  <div key={domain.id} className="flex items-center gap-3">
                    <span className="text-xs text-white/40 w-20 flex-shrink-0">{domain.icon} {domain.label}</span>
                    <TrendLine history={history} domain={domain.id} />
                    <span className="text-xs font-bold w-4 text-right" style={{ color: domain.color }}>
                      {history[history.length - 1]?.scores?.[domain.id] ?? '–'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Weekly entries */}
              {[...history].reverse().map((entry, i) => (
                <div key={i} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-xs">
                      {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="font-bold text-lg" style={{ color: entry.overall <= 2 ? 'var(--jade)' : entry.overall <= 5 ? 'var(--amber)' : 'var(--rose)' }}>
                      {entry.overall}/8
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {DOMAINS.map(d => (
                      <span key={d.id} className="text-xs px-2 py-0.5 rounded-full glass" style={{ color: d.color }}>
                        {d.icon} {entry.scores?.[d.id] ?? '–'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── INSIGHTS VIEW ── */}
      {view === 'insights' && (
        <div className="px-4 space-y-4 animate-fade-in">
          {history.length < 2 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-3">💡</div>
              <p className="text-white/50 text-sm">Complete at least 2 weekly ratings to see insights here.</p>
            </div>
          ) : (
            <>
              {/* Best/worst weeks */}
              {(() => {
                const best = [...history].sort((a, b) => a.overall - b.overall)[0]
                const worst = [...history].sort((a, b) => b.overall - a.overall)[0]
                const avg = Math.round(history.reduce((s, e) => s + e.overall, 0) / history.length)
                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="card text-center">
                        <p className="text-jade font-bold text-xl">{best.overall}</p>
                        <p className="text-white/40 text-xs">Best week</p>
                      </div>
                      <div className="card text-center">
                        <p className="text-aqua font-bold text-xl">{avg}</p>
                        <p className="text-white/40 text-xs">Average</p>
                      </div>
                      <div className="card text-center">
                        <p className="text-rose font-bold text-xl">{worst.overall}</p>
                        <p className="text-white/40 text-xs">Hardest week</p>
                      </div>
                    </div>

                    {/* Domain breakdown */}
                    <div className="card-lg space-y-3">
                      <p className="text-white/70 text-sm font-semibold">Average impact by area</p>
                      {DOMAINS.map(d => {
                        const domainAvg = Math.round(history.reduce((s, e) => s + (e.scores?.[d.id] || 0), 0) / history.length)
                        return (
                          <div key={d.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/60">{d.icon} {d.label}</span>
                              <span className="font-semibold" style={{ color: d.color }}>{domainAvg}/8</span>
                            </div>
                            <div className="prog-track">
                              <div className="prog-fill" style={{ width: `${(domainAvg / 8) * 100}%`, background: d.color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Progress direction */}
                    {history.length >= 3 && (() => {
                      const recent3 = history.slice(-3).map(e => e.overall)
                      const improving = recent3[2] < recent3[0]
                      return (
                        <div className={`glass rounded-2xl p-4 border ${improving ? 'border-jade/20' : 'border-amber/20'}`}>
                          <p className={`text-sm font-semibold mb-1 ${improving ? 'text-jade' : 'text-amber'}`}>
                            {improving ? '↓ Trending down' : '↑ Trending up'} over last 3 weeks
                          </p>
                          <p className="text-white/50 text-xs leading-relaxed">
                            {improving
                              ? "Your impact scores are decreasing — that means stuttering is affecting your life less. Whatever you've been doing is working. Keep at it."
                              : "Your scores have risen recently. This doesn't mean you're getting worse — life gets harder sometimes and that affects everything. Consider talking to Flux about what's been going on."}
                          </p>
                        </div>
                      )
                    })()}
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
