import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak, getSetting, setSetting } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { CBT_THOUGHT_RECORD, ACT_VALUES_DOMAINS, ACT_DEFUSION_EXERCISES, getOfflineResponse } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const TABS = [
  { id: 'thought_record', label: 'Thought Record', icon: '📝', desc: 'Challenge anxious thoughts' },
  { id: 'values', label: 'My Values', icon: '🧭', desc: 'What matters most to you' },
  { id: 'defusion', label: 'Defusion', icon: '🫧', desc: 'Loosen the grip of thoughts' },
  { id: 'history', label: 'My Records', icon: '📚', desc: 'Past thought records' },
]

export default function MindShift() {
  const [tab, setTab] = useState('thought_record')
  const [thoughtRecord, setThoughtRecord] = useState({})
  const [currentStep, setCurrentStep] = useState(0)
  const [savedRecords, setSavedRecords] = useState([])
  const [savedValues, setSavedValues] = useState({})
  const [activeDefusion, setActiveDefusion] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fluxMsg, setFluxMsg] = useState(getOfflineResponse('encouragement'))
  const [showComplete, setShowComplete] = useState(false)
  const navigate = useNavigate()
  const { profile, refreshProfile, triggerFlux } = useApp()
  const { fluxSay } = useFluxVoice()
  const ag = profile?.ageGroup || 'explorer'

  useEffect(() => {
    const load = async () => {
      const records = await getSetting('mindshift_records', [])
      const values = await getSetting('mindshift_values', {})
      setSavedRecords(Array.isArray(records) ? records : [])
      setSavedValues(values || {})
    }
    load()
  }, [])

  const handleThoughtInput = (stepId, value) => {
    setThoughtRecord(prev => ({ ...prev, [stepId]: value }))
  }

  const handleNextStep = () => {
    const steps = CBT_THOUGHT_RECORD.steps
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  const handleSaveRecord = async () => {
    setSaving(true)
    const record = { ...thoughtRecord, date: new Date().toISOString(), id: Date.now() }
    const existing = await getSetting('mindshift_records', [])
    const updated = [record, ...(Array.isArray(existing) ? existing : [])].slice(0, 20)
    await setSetting('mindshift_records', updated)
    setSavedRecords(updated)
    await addSession('mindshift', 80, { type: 'thought_record' })
    await markTodayStreak()
    await refreshProfile()
    setSaving(false)
    setShowComplete(true)
    setThoughtRecord({})
    setCurrentStep(0)
    const msg = getOfflineResponse('encouragement')
    setFluxMsg(msg)
    fluxSay(msg)
    triggerFlux(msg)
    setTimeout(() => setShowComplete(false), 3000)
  }

  const handleSaveValues = async (domain, value) => {
    const updated = { ...savedValues, [domain]: value }
    setSavedValues(updated)
    await setSetting('mindshift_values', updated)
  }

  const currentStepData = CBT_THOUGHT_RECORD.steps[currentStep]
  const completedSteps = CBT_THOUGHT_RECORD.steps.filter(s => thoughtRecord[s.id]?.trim()).length
  const allFilled = CBT_THOUGHT_RECORD.steps.every(s => thoughtRecord[s.id]?.trim())

  return (
    <div className="relative min-h-full pb-28" style={{ zIndex: 1 }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(-1)} className="w-9 h-9 glass rounded-xl flex items-center justify-center text-white/60">←</button>
          <div>
            <h1 className="text-xl font-bold font-display text-white">MindShift</h1>
            <p className="text-xs text-white/40">CBT · ACT · Cognitive tools</p>
          </div>
        </div>
      </div>

      {/* Flux + message */}
      <div className="px-4 mb-4">
        <div className="card flex items-start gap-3">
          <div className="animate-flux-float flex-shrink-0">
            <Flux size={44} ageGroup={ag} mood="thinking" />
          </div>
          <p className="text-white/80 text-sm leading-relaxed">{fluxMsg}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 mb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all font-display ${tab === t.id ? 'text-[#05080f]' : 'glass text-white/50 hover:text-white/80'}`}
              style={tab === t.id ? { background: 'var(--violet)', boxShadow: 'var(--glow-violet)' } : {}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── THOUGHT RECORD ── */}
      {tab === 'thought_record' && (
        <div className="px-4 space-y-4 animate-fade-in">
          {showComplete ? (
            <div className="card text-center py-8">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-white font-bold text-lg mb-1">Thought record complete!</p>
              <p className="text-white/50 text-sm">Saved. Your brain just did cognitive therapy.</p>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-xs">Step {currentStep + 1} of {CBT_THOUGHT_RECORD.steps.length}</span>
                  <span className="text-white/40 text-xs">{completedSteps}/{CBT_THOUGHT_RECORD.steps.length} filled</span>
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${(completedSteps / CBT_THOUGHT_RECORD.steps.length) * 100}%`, background: 'var(--violet)' }} />
                </div>
                <div className="flex gap-1 mt-3">
                  {CBT_THOUGHT_RECORD.steps.map((s, i) => (
                    <button key={s.id} onClick={() => setCurrentStep(i)}
                      className={`flex-1 h-2 rounded-full transition-all ${i === currentStep ? 'opacity-100' : thoughtRecord[s.id] ? 'opacity-60' : 'opacity-20'}`}
                      style={{ background: thoughtRecord[s.id] ? 'var(--violet)' : i === currentStep ? 'var(--aqua)' : 'rgba(255,255,255,0.3)' }} />
                  ))}
                </div>
              </div>

              {/* Current step */}
              <div className="card-lg space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-[#05080f]" style={{ background: 'var(--violet)' }}>{currentStep + 1}</span>
                  <h3 className="text-white font-semibold">{currentStepData.label}</h3>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">{currentStepData.prompt}</p>
                <textarea
                  value={thoughtRecord[currentStepData.id] || ''}
                  onChange={e => handleThoughtInput(currentStepData.id, e.target.value)}
                  placeholder={currentStep === 0 ? 'e.g. I had to answer a question in a meeting and started stuttering badly...' :
                    currentStep === 1 ? 'e.g. Anxious 85, Ashamed 70, Embarrassed 60...' :
                    currentStep === 2 ? 'e.g. Everyone thinks I\'m incompetent...' :
                    currentStep === 3 ? 'e.g. My boss looked down, people shifted in their seats...' :
                    currentStep === 4 ? 'e.g. My boss asked me to present again next week, nobody said anything...' :
                    currentStep === 5 ? 'e.g. I struggled in that moment. That doesn\'t mean everyone thinks I\'m incompetent...' :
                    'e.g. Anxiety down to 50. Still uncomfortable but feels more manageable...'}
                  className="input-field min-h-[120px] text-sm"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* CBT Insight card for evidence steps */}
              {(currentStep === 3 || currentStep === 4) && (
                <div className="glass rounded-2xl p-4 border" style={{ borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
                  <p className="text-white/50 text-xs leading-relaxed">
                    <span className="text-violet-400 font-semibold">CBT tip:</span> Be as specific and factual as possible. We're looking for evidence — not feelings or interpretations, but actual observable facts.
                  </p>
                </div>
              )}

              {currentStep === 5 && (
                <div className="glass rounded-2xl p-4 border" style={{ borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
                  <p className="text-white/50 text-xs leading-relaxed">
                    <span className="text-violet-400 font-semibold">CBT tip:</span> The balanced thought doesn't need to be positive — just accurate. "I stuttered AND I still communicated my point" is more accurate than either extreme.
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <button onClick={handlePrevStep} className="flex-1 btn-ghost py-3 text-sm">← Back</button>
                )}
                {currentStep < CBT_THOUGHT_RECORD.steps.length - 1 ? (
                  <button onClick={handleNextStep}
                    disabled={!thoughtRecord[currentStepData.id]?.trim()}
                    className="flex-1 btn py-3 text-sm font-semibold rounded-2xl transition-all disabled:opacity-40"
                    style={{ background: 'var(--violet)', color: '#fff' }}>
                    Next →
                  </button>
                ) : (
                  <button onClick={handleSaveRecord}
                    disabled={!allFilled || saving}
                    className="flex-1 btn py-3 text-sm font-semibold rounded-2xl transition-all disabled:opacity-40"
                    style={{ background: 'var(--violet)', color: '#fff' }}>
                    {saving ? 'Saving...' : '✓ Save Record'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VALUES EXPLORER ── */}
      {tab === 'values' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card">
            <p className="text-white/70 text-sm leading-relaxed">
              Values are what make speaking worth the effort. Understanding yours gives you a "why" that's bigger than the fear.
            </p>
          </div>
          {ACT_VALUES_DOMAINS.map(domain => (
            <div key={domain.id} className="card-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{domain.icon}</span>
                <h3 className="text-white font-semibold text-sm">{domain.label}</h3>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">{domain.prompt}</p>
              <textarea
                value={savedValues[domain.id] || ''}
                onChange={e => handleSaveValues(domain.id, e.target.value)}
                placeholder="Write your thoughts here... (auto-saves)"
                className="input-field text-sm"
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
              {savedValues[domain.id] && (
                <p className="text-xs text-jade/70">✓ Saved</p>
              )}
            </div>
          ))}

          {/* Values summary */}
          {Object.keys(savedValues).filter(k => savedValues[k]).length >= 3 && (
            <div className="glass rounded-2xl p-4 border" style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.05)' }}>
              <p className="text-jade/80 text-sm font-semibold mb-1">Your values are clear.</p>
              <p className="text-white/50 text-xs leading-relaxed">
                When anxiety makes speaking feel impossible, return to these. Ask: "Is what I want to say in service of something that matters to me?" If yes — that's your reason to speak.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── DEFUSION ── */}
      {tab === 'defusion' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card">
            <p className="text-white/70 text-sm leading-relaxed">
              Cognitive defusion is an ACT technique for loosening the grip of anxious thoughts. You don't have to believe every thought your mind produces.
            </p>
          </div>

          {activeDefusion ? (
            <div className="card-lg space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold">{activeDefusion.title}</h3>
                <button onClick={() => setActiveDefusion(null)} className="text-white/40 text-sm hover:text-white/70">✕ Close</button>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">{activeDefusion.instruction}</p>

              <div className="glass rounded-2xl p-4 border" style={{ borderColor: 'rgba(167,139,250,0.2)' }}>
                <p className="text-white/50 text-xs">Try it now with this common thought:</p>
                <p className="text-white/80 text-sm mt-1 italic">"I'm going to stutter and everyone will judge me."</p>
              </div>

              <div className="glass rounded-2xl p-4 border" style={{ borderColor: 'rgba(167,139,250,0.2)' }}>
                <p className="text-white/50 text-xs mb-2">How does the thought feel after the exercise?</p>
                <div className="flex gap-2">
                  {['Same weight', 'A bit lighter', 'Much lighter', 'Almost gone'].map(opt => (
                    <button key={opt} onClick={() => { setActiveDefusion(null); addSession('mindshift_defusion', 75) }}
                      className="flex-1 text-xs py-2 rounded-xl glass text-white/60 hover:text-white transition-all" style={{ fontSize: '10px' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {ACT_DEFUSION_EXERCISES.map(ex => (
                <button key={ex.id} onClick={() => setActiveDefusion(ex)}
                  className="w-full card text-left hover:border-violet-500/30 transition-all active:scale-95">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(167,139,250,0.15)' }}>
                      <span className="text-lg">🫧</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{ex.title}</p>
                      <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{ex.instruction.slice(0, 80)}...</p>
                    </div>
                    <span className="text-white/30 ml-auto">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="glass rounded-2xl p-4 border" style={{ borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
            <p className="text-violet-300/80 text-xs font-semibold mb-1">What is defusion?</p>
            <p className="text-white/50 text-xs leading-relaxed">
              Thoughts are just mental events — they're not facts, not commands, not predictions. Defusion techniques create distance between you and your thoughts, so you can choose your response rather than being controlled by the thought.
            </p>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div className="px-4 space-y-4 animate-fade-in">
          {savedRecords.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-3">📝</div>
              <p className="text-white/50 text-sm">Complete your first thought record and it will appear here.</p>
            </div>
          ) : (
            savedRecords.map(record => (
              <div key={record.id} className="card-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">{new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="pill-violet text-xs">Thought Record</span>
                </div>
                {record.situation && (
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">Situation</p>
                    <p className="text-white/80 text-sm">{record.situation}</p>
                  </div>
                )}
                {record.thought && (
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">Hot thought</p>
                    <p className="text-white/80 text-sm italic">"{record.thought}"</p>
                  </div>
                )}
                {record.alternative && (
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">Balanced perspective</p>
                    <p className="text-jade/80 text-sm">{record.alternative}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
