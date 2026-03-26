import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile, setSetting, getSetting, db, clearMemory } from '../utils/db'
import { loadMemory, MemoryKeys } from '../ai/fluxEngine'
import { getVoices, ttsAvailable } from '../ai/voiceEngine'
import { useApp } from '../hooks/useAppContext'
import Flux from '../components/flux/Flux'

const AGE_GROUPS = [
  { id: 'little',    label: 'Little Speaker', ages: '3–6',  icon: '🌈', accent: '#fb7185' },
  { id: 'explorer',  label: 'Explorer',        ages: '7–12', icon: '🗺️', accent: '#22d3ee' },
  { id: 'navigator', label: 'Navigator',        ages: '13–17',icon: '🧭', accent: '#a78bfa' },
  { id: 'adult',     label: 'Adult',            ages: '18+',  icon: '🌊', accent: '#34d399' },
]

const MODES = [
  { id: 'stutter', label: 'Stutter Confidence', icon: '💧', accent: '#22d3ee' },
  { id: 'comm',    label: 'Communication Coach', icon: '🎙️', accent: '#a78bfa' },
]

export default function Settings() {
  const [profileData, setProfileData] = useState(null)
  const [name, setName]               = useState('')
  const [ageGroup, setAgeGroup]       = useState('explorer')
  const [mode, setMode]               = useState('stutter')
  const [notifications, setNotifications] = useState(true)
  const [autoSpeak, setAutoSpeak]     = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [showReset, setShowReset]     = useState(false)
  const [showMemoryReset, setShowMemoryReset] = useState(false)
  const [memoryStats, setMemoryStats] = useState({ insights: 0, strengths: 0 })
  const [voices, setVoices]           = useState([])
  const navigate  = useNavigate()
  const { loadProfile, signOut, userEmail } = useApp()

  useEffect(() => {
    const load = async () => {
      const p = await getProfile()
      if (p) { setProfileData(p); setName(p.name||''); setAgeGroup(p.ageGroup||'explorer'); setMode(p.mode||'stutter') }
      const notif = await getSetting('notifications', true)
      const speak = await getSetting('autoSpeak', true)
      setNotifications(notif); setAutoSpeak(speak)
      const ins = await loadMemory(MemoryKeys.INSIGHTS, [])
      const str = await loadMemory(MemoryKeys.STRENGTHS, [])
      setMemoryStats({ insights: ins.length, strengths: str.length })
      if (ttsAvailable()) setVoices(getVoices().slice(0, 8))
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await saveProfile({ ...profileData, name: name.trim(), ageGroup, mode })
    await setSetting('notifications', notifications)
    await setSetting('autoSpeak', autoSpeak)
    await loadProfile()
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleFullReset = async () => {
    await Promise.all([
      db.sessions.clear(), db.recordings.clear(), db.fearLadder.clear(),
      db.progress.clear(), db.journal.clear(), db.braveStars.clear(),
      db.streaks.clear(), db.profile.clear(), db.settings.clear(),
    ])
    navigate('/onboarding', { replace: true })
  }

  const handleMemoryReset = async () => {
    await clearMemory()
    setMemoryStats({ insights: 0, strengths: 0 })
    setShowMemoryReset(false)
  }

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)}
      className="w-12 h-6 rounded-full transition-all duration-200 relative flex-shrink-0"
      style={{ background: value ? 'var(--aqua)' : 'rgba(255,255,255,0.15)' }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
           style={{ left: value ? '24px' : '2px' }}/>
    </button>
  )

  const Section = ({ title, children }) => (
    <div className="mb-6">
      <p className="section-label mb-3 px-1">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )

  const Row = ({ icon, label, sublabel, right }) => (
    <div className="card flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
           style={{ background: 'rgba(255,255,255,0.06)' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-white text-sm">{label}</div>
        {sublabel && <div className="text-white/35 text-xs truncate">{sublabel}</div>}
      </div>
      {right}
    </div>
  )

  return (
    <div className="min-h-full pb-28 page-enter" style={{ zIndex: 1 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-white">Settings</h1>
        </div>
        <Flux size={40} ageGroup={ageGroup} mood="happy" />
      </div>

      <div className="px-5">

        {/* Profile Card */}
        <div className="card-lg mb-6 flex items-center gap-4"
             style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(167,139,250,0.06))' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-xl"
               style={{ background: 'linear-gradient(135deg, var(--aqua), var(--violet))', color: '#05080f' }}>
            {name.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-display font-bold text-white text-lg">{name || 'Your name'}</div>
            <div className="flex gap-2 mt-1">
              <span className="pill" style={{ background:'rgba(34,211,238,0.1)', borderColor:'rgba(34,211,238,0.25)', color:'var(--aqua)', fontSize:'10px' }}>
                {AGE_GROUPS.find(g=>g.id===ageGroup)?.icon} {AGE_GROUPS.find(g=>g.id===ageGroup)?.label}
              </span>
              <span className="pill" style={{ background:'rgba(167,139,250,0.1)', borderColor:'rgba(167,139,250,0.25)', color:'var(--violet)', fontSize:'10px' }}>
                {MODES.find(m=>m.id===mode)?.icon} {MODES.find(m=>m.id===mode)?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Profile */}
        <Section title="Profile">
          <div>
            <label className="text-white/40 text-xs mb-1.5 block px-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="input-field" placeholder="Your name" />
          </div>
        </Section>

        {/* Age Group */}
        <Section title="Age Group">
          <div className="grid grid-cols-2 gap-2">
            {AGE_GROUPS.map(g => (
              <button key={g.id} onClick={() => setAgeGroup(g.id)}
                className="p-3 rounded-2xl border text-left transition-all active:scale-95"
                style={{
                  background: ageGroup===g.id ? `${g.accent}10` : 'rgba(255,255,255,0.04)',
                  borderColor: ageGroup===g.id ? `${g.accent}40` : 'rgba(255,255,255,0.09)',
                }}>
                <span className="text-lg mr-2">{g.icon}</span>
                <span className="font-display text-white text-sm">{g.label}</span>
                <div className="text-white/30 text-xs mt-0.5">Ages {g.ages}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Mode */}
        <Section title="App Mode">
          <div className="space-y-2">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className="w-full p-4 rounded-2xl border text-left transition-all active:scale-[0.98] flex items-center gap-3"
                style={{
                  background: mode===m.id ? `${m.accent}10` : 'rgba(255,255,255,0.04)',
                  borderColor: mode===m.id ? `${m.accent}35` : 'rgba(255,255,255,0.09)',
                }}>
                <span className="text-2xl">{m.icon}</span>
                <span className="font-display font-semibold text-white">{m.label}</span>
                {mode===m.id && (
                  <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                       style={{ background: m.accent }}>
                    <svg className="w-3 h-3" fill="#05080f" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* Voice & Notifications */}
        <Section title="Voice & Notifications">
          <Row icon="🔊" label="Auto-speak Flux replies" sublabel="Flux reads responses aloud"
            right={<Toggle value={autoSpeak} onChange={setAutoSpeak} />} />
          <Row icon="🔔" label="Daily reminder" sublabel="Gentle nudge from Flux"
            right={<Toggle value={notifications} onChange={setNotifications} />} />
        </Section>

        {/* AI Memory */}
        <Section title="AI Memory">
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.15)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                   style={{ background: 'rgba(34,211,238,0.1)' }}>🧠</div>
              <div>
                <div className="font-display font-semibold text-white text-sm">Flux Memory</div>
                <div className="text-white/40 text-xs">{memoryStats.insights} insights · {memoryStats.strengths} strengths tracked</div>
              </div>
            </div>
            <p className="text-white/50 text-xs leading-relaxed mb-3">
              Flux learns from every session, building a personal model of your strengths, growth areas, and patterns. This makes recommendations smarter over time.
            </p>
            {!showMemoryReset ? (
              <button onClick={() => setShowMemoryReset(true)} className="text-white/30 text-xs hover:text-white/50 transition-colors">
                Reset Flux memory…
              </button>
            ) : (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-red-300 text-xs mb-2">This clears all Flux insights, strengths, and learned patterns. Your sessions stay safe.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowMemoryReset(false)} className="btn-ghost flex-1 text-xs py-1.5 font-display">Cancel</button>
                  <button onClick={handleMemoryReset} className="btn-danger flex-1 text-xs py-1.5 font-display">Reset Memory</button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="btn-aqua w-full py-4 font-display text-base mb-4 transition-all"
          style={{ color: '#05080f' }}>
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* About */}
        <div className="card text-center mb-6" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="animate-flux-float inline-block mb-2">
            <Flux size={48} ageGroup={ageGroup} mood="happy" floating={false} />
          </div>
          <div className="font-display font-bold text-white">YoSpeech v2.0</div>
          <div className="text-white/35 text-sm mt-1">Find Your Flow</div>
          <div className="text-white/20 text-xs mt-2">By SayMyTech Developers · 2025</div>
          <div className="text-white/15 text-xs mt-1">All data stored on your device · 100% offline</div>
        </div>

        {/* Account */}
        <Section title="Account">
          {userEmail ? (
            <Row icon="📧" label="Signed in as" sublabel={userEmail}
              right={
                <button onClick={async () => { await signOut(); navigate('/auth', { replace: true }) }}
                  style={{ padding:'6px 14px', borderRadius:'10px', background:'rgba(251,113,133,0.12)',
                    border:'1px solid rgba(251,113,133,0.25)', color:'#fb7185', fontSize:'12px',
                    fontFamily:'"Syne",sans-serif', fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                  Sign Out
                </button>
              }
            />
          ) : (
            <Row icon="👤" label="Guest mode" sublabel="No account — data stored locally"
              right={
                <button onClick={() => navigate('/auth')}
                  style={{ padding:'6px 14px', borderRadius:'10px', background:'rgba(34,211,238,0.1)',
                    border:'1px solid rgba(34,211,238,0.25)', color:'var(--aqua)', fontSize:'12px',
                    fontFamily:'"Syne",sans-serif', fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                  Sign In
                </button>
              }
            />
          )}
        </Section>

        {/* Danger Zone */}
        <div className="mb-8">
          {!showReset ? (
            <button onClick={() => setShowReset(true)}
              className="text-white/25 text-xs hover:text-red-400 transition-colors">
              Delete all data and start over…
            </button>
          ) : (
            <div className="p-4 rounded-2xl" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
              <p className="text-red-300 text-sm mb-3 leading-relaxed">This permanently deletes all sessions, recordings, journal entries, progress, and Flux memory. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowReset(false)} className="btn-ghost flex-1 text-sm py-2.5 font-display">Cancel</button>
                <button onClick={handleFullReset} className="btn-danger flex-1 text-sm py-2.5 font-display">Delete Everything</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
