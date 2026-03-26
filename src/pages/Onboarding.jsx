import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfile, setSetting } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse } from '../ai/fluxEngine'
import { speakFlux, preloadVoices } from '../ai/voiceEngine'
import Flux from '../components/flux/Flux'

const AGE_GROUPS = [
  { id: 'little',    label: 'Little Speaker', ages: '3–6',  icon: '🌈', desc: 'Parent-guided adventures',        accent: '#fb7185' },
  { id: 'explorer',  label: 'Explorer',        ages: '7–12', icon: '🗺️', desc: 'Full adventure mode',             accent: '#22d3ee' },
  { id: 'navigator', label: 'Navigator',        ages: '13–17',icon: '🧭', desc: 'Teen missions + DAF mode',        accent: '#a78bfa' },
  { id: 'adult',     label: 'Adult',            ages: '18+',  icon: '🌊', desc: 'Professional scenarios + ACT',   accent: '#34d399' },
]

const MODES = [
  {
    id: 'stutter',
    label: 'Stutter Confidence',
    icon: '💧',
    desc: 'Speech therapy techniques, fear ladder, breathing exercises, BraveMissions',
    accent: '#22d3ee',
    bg: 'rgba(34,211,238,0.08)',
    border: 'rgba(34,211,238,0.3)',
  },
  {
    id: 'comm',
    label: 'Communication Coach',
    icon: '🎙️',
    desc: 'Public speaking, presentations, interviews, storytelling, vocal confidence',
    accent: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.3)',
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedMode, setSelectedMode] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { loadProfile, triggerFlux } = useApp()

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await saveProfile({
        name: name.trim(),
        ageGroup: selectedGroup?.id || 'explorer',
        mode: selectedMode?.id || 'stutter',
      })
      await setSetting('onboarded', true)
      await loadProfile()
      preloadVoices()
      const msg = getOfflineResponse('onboarding')
      triggerFlux(msg)
      navigate('/home', { replace: true })
    } catch (e) {
      console.error(e)
      setSaving(false)
    }
  }

  const canContinue = [
    true,
    !!selectedGroup,
    !!selectedMode,
    name.trim().length > 0,
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-5 py-10 overflow-hidden relative"
         style={{ background: 'var(--ink)' }}>

      {/* Aurora BG */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08), transparent 70%)' }}/>
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.06), transparent 70%)' }}/>
      </div>

      <div className="relative w-full max-w-sm flex flex-col" style={{ minHeight: '85vh' }}>

        {/* Step dots */}
        {step > 0 && (
          <div className="flex gap-2 justify-center mb-8 animate-fade-in">
            {[1,2,3].map(i => (
              <div key={i} className="h-1 rounded-full transition-all duration-400"
                   style={{
                     width: step >= i ? '24px' : '8px',
                     background: step >= i ? 'var(--aqua)' : 'rgba(255,255,255,0.15)',
                   }}/>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">

          {/* ── Step 0 — Welcome ── */}
          {step === 0 && (
            <div className="flex flex-col items-center gap-8 text-center animate-scale-in">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full animate-pulse-ring"
                       style={{ border: '1px solid rgba(34,211,238,0.15)', animationDuration: '3s' }}/>
                </div>
                <div className="animate-flux-float">
                  <Flux size={140} ageGroup="explorer" mood="happy" floating={false} />
                </div>
              </div>

              <div>
                <h1 className="font-display text-4xl font-bold text-white mb-3 leading-tight">
                  YO — this is<br/>
                  <span style={{ background: 'linear-gradient(135deg, var(--aqua), var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    YOUR voice.
                  </span>
                </h1>
                <p className="text-white/50 text-base leading-relaxed">
                  I'm Flux — your AI companion on the journey to finding your flow. Ready to begin?
                </p>
              </div>

              <div className="w-full space-y-3">
                <button className="btn-aqua w-full text-lg py-4 font-display" style={{ color: '#05080f' }}
                  onClick={() => { preloadVoices(); setStep(1) }}>
                  Find My Flow 🌊
                </button>
                <p className="text-white/25 text-xs">Free · No account needed · Works offline</p>
              </div>
            </div>
          )}

          {/* ── Step 1 — Age Group ── */}
          {step === 1 && (
            <div className="flex flex-col gap-5 animate-slide-up">
              <div className="text-center">
                <Flux size={80} ageGroup={selectedGroup?.id || 'explorer'} mood="happy" floating={false}
                  className="mb-4 mx-auto animate-flux-float" />
                <h2 className="font-display text-2xl font-bold text-white mb-2">Who's flowing today?</h2>
                <p className="text-white/40 text-sm">I'll adapt my language, voice, and features for you.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {AGE_GROUPS.map(g => (
                  <button key={g.id} onClick={() => setSelectedGroup(g)}
                    className="relative p-4 rounded-2xl border text-left transition-all duration-200 active:scale-95"
                    style={{
                      background: selectedGroup?.id === g.id ? `${g.accent}12` : 'rgba(255,255,255,0.04)',
                      borderColor: selectedGroup?.id === g.id ? `${g.accent}50` : 'rgba(255,255,255,0.09)',
                      transform: selectedGroup?.id === g.id ? 'scale(1.02)' : 'scale(1)',
                    }}>
                    <div className="text-2xl mb-2">{g.icon}</div>
                    <div className="font-display font-bold text-white text-sm">{g.label}</div>
                    <div className="text-white/40 text-xs">{g.ages}</div>
                    <div className="text-white/30 text-xs mt-1 leading-tight">{g.desc}</div>
                    {selectedGroup?.id === g.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                           style={{ background: g.accent }}>
                        <svg className="w-3 h-3" fill="#05080f" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(2)} disabled={!selectedGroup}
                className="btn-aqua w-full py-4 font-display disabled:opacity-30 transition-all" style={{ color: '#05080f' }}>
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2 — Mode ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5 animate-slide-up">
              <div className="text-center">
                <Flux size={80} ageGroup={selectedGroup?.id || 'explorer'} mood="happy" floating={false}
                  className="mb-4 mx-auto animate-flux-float" />
                <h2 className="font-display text-2xl font-bold text-white mb-2">What's your focus?</h2>
                <p className="text-white/40 text-sm">You can switch anytime in settings.</p>
              </div>

              <div className="space-y-3">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setSelectedMode(m)}
                    className="w-full p-5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.98]"
                    style={{
                      background: selectedMode?.id === m.id ? m.bg : 'rgba(255,255,255,0.04)',
                      borderColor: selectedMode?.id === m.id ? m.border : 'rgba(255,255,255,0.09)',
                    }}>
                    <div className="flex items-start gap-4">
                      <div className="text-3xl flex-shrink-0 mt-0.5">{m.icon}</div>
                      <div className="flex-1">
                        <div className="font-display font-bold text-white mb-1">{m.label}</div>
                        <div className="text-white/50 text-sm leading-relaxed">{m.desc}</div>
                      </div>
                      {selectedMode?.id === m.id && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                             style={{ background: m.accent }}>
                          <svg className="w-3.5 h-3.5" fill="#05080f" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(3)} disabled={!selectedMode}
                className="btn-aqua w-full py-4 font-display disabled:opacity-30" style={{ color: '#05080f' }}>
                Continue →
              </button>
              <button onClick={() => setStep(1)} className="btn-ghost w-full py-3 text-sm font-display">← Back</button>
            </div>
          )}

          {/* ── Step 3 — Name ── */}
          {step === 3 && (
            <div className="flex flex-col gap-6 items-center animate-slide-up">
              <Flux size={100} ageGroup={selectedGroup?.id || 'explorer'} mood="excited" floating={false}
                className="animate-flux-float" />
              <div className="text-center">
                <h2 className="font-display text-2xl font-bold text-white mb-2">What should I call you?</h2>
                <p className="text-white/40 text-sm">Just your first name is perfect.</p>
              </div>

              <input type="text" value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && handleSave()}
                placeholder="Your name…" maxLength={30} autoFocus
                className="input-field text-center text-xl font-display w-full" />

              <div className="w-full space-y-3">
                <button onClick={handleSave} disabled={!name.trim() || saving}
                  className="btn-aqua w-full text-lg py-4 font-display disabled:opacity-30" style={{ color: '#05080f' }}>
                  {saving ? 'Starting your journey…' : "Let's Go! 🚀"}
                </button>
                <button onClick={() => setStep(2)} className="btn-ghost w-full py-3 text-sm font-display">← Back</button>
              </div>

              {/* Summary */}
              {name.trim() && (
                <div className="flex gap-2 flex-wrap justify-center animate-fade-in">
                  <span className="pill" style={{ background: `${selectedGroup?.accent || '#22d3ee'}12`, borderColor: `${selectedGroup?.accent || '#22d3ee'}30`, color: selectedGroup?.accent || '#22d3ee' }}>
                    {selectedGroup?.icon} {selectedGroup?.label}
                  </span>
                  <span className="pill" style={{ background: `${selectedMode?.accent || '#22d3ee'}12`, borderColor: `${selectedMode?.accent || '#22d3ee'}30`, color: selectedMode?.accent || '#22d3ee' }}>
                    {selectedMode?.icon} {selectedMode?.label}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
