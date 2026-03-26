import { useState, useEffect } from 'react'
import { setSetting, getSetting } from '../../utils/db'
import { getOfflineResponse } from '../../ai/fluxEngine'
import { speakFlux } from '../../ai/voiceEngine'
import Flux from '../flux/Flux'

const MOODS = [
  { id: 'amazing',   emoji: '🤩', label: 'Amazing',  color: '#fbbf24', response: 'celebration',   fluxMood: 'excited' },
  { id: 'good',      emoji: '😊', label: 'Good',     color: '#34d399', response: 'encouragement', fluxMood: 'happy'   },
  { id: 'okay',      emoji: '😐', label: 'Okay',     color: '#22d3ee', response: 'general',       fluxMood: 'calm'    },
  { id: 'rough',     emoji: '😔', label: 'Rough',    color: '#a78bfa', response: 'struggle',      fluxMood: 'sad'     },
  { id: 'stressed',  emoji: '😰', label: 'Stressed', color: '#fb7185', response: 'breathing',     fluxMood: 'sad'     },
]

export default function DailyCheckIn({ onComplete, ageGroup = 'explorer' }) {
  const [selected, setSelected] = useState(null)
  const [fluxMsg, setFluxMsg]   = useState('')
  const [done, setDone]         = useState(false)

  const handleSelect = async (mood) => {
    setSelected(mood)
    const msg = getOfflineResponse(mood.response)
    setFluxMsg(msg)
    speakFlux(msg, ageGroup)
    await setSetting('today_mood', mood.id)
    await setSetting('today_mood_date', new Date().toDateString())
    setTimeout(() => { setDone(true); onComplete?.(mood) }, 2200)
  }

  if (done) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(5,8,15,0.8)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-md animate-slide-up" style={{
        background: 'linear-gradient(180deg, rgba(12,17,32,0.98) 0%, rgba(5,8,15,0.99) 100%)',
        borderRadius: '28px 28px 0 0',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottom: 'none',
        padding: '28px 24px 40px',
      }}>
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.15)' }}/>

        <div className="flex items-center gap-3 mb-6">
          <Flux size={48} ageGroup={ageGroup} mood={selected?.fluxMood || 'happy'} floating={false}
            style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.3))' }}/>
          <div>
            <p style={{ fontFamily:'"Syne",sans-serif', fontWeight:700, fontSize:'17px', color:'white' }}>
              How are you feeling today?
            </p>
            <p style={{ fontFamily:'"DM Sans",sans-serif', fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>
              This shapes what Flux recommends for you
            </p>
          </div>
        </div>

        {/* Mood grid */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {MOODS.map(m => (
            <button key={m.id} onClick={() => handleSelect(m)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
                padding:'10px 4px', borderRadius:'16px',
                background: selected?.id === m.id ? `${m.color}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selected?.id === m.id ? m.color + '50' : 'rgba(255,255,255,0.08)'}`,
                cursor:'pointer', transition:'all 0.15s',
                transform: selected?.id === m.id ? 'scale(1.1)' : 'scale(1)',
              }}>
              <span style={{ fontSize:'24px', lineHeight:1 }}>{m.emoji}</span>
              <span style={{ fontSize:'9px', fontFamily:'"Syne",sans-serif', fontWeight:600,
                letterSpacing:'0.05em', color: selected?.id === m.id ? m.color : 'rgba(255,255,255,0.4)' }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>

        {/* Flux response */}
        {fluxMsg && (
          <div className="animate-fade-in" style={{
            padding:'12px 16px', borderRadius:'14px',
            background: `${selected?.color || '#22d3ee'}10`,
            border: `1px solid ${selected?.color || '#22d3ee'}25`,
          }}>
            <p style={{ fontFamily:'"DM Sans",sans-serif', fontSize:'13px', color:'rgba(255,255,255,0.75)',
              lineHeight:1.6, textAlign:'center' }}>
              {fluxMsg}
            </p>
          </div>
        )}

        {!selected && (
          <button onClick={() => { setDone(true); onComplete?.(null) }}
            style={{ background:'none', border:'none', cursor:'pointer', display:'block', margin:'12px auto 0',
              fontFamily:'"DM Sans",sans-serif', fontSize:'12px', color:'rgba(255,255,255,0.25)' }}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

// Hook to determine if check-in should show
export const useCheckIn = () => {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const check = async () => {
      const lastDate = await getSetting('today_mood_date', null)
      const today = new Date().toDateString()
      setShouldShow(lastDate !== today)
    }
    // Slight delay so app loads first
    setTimeout(check, 1500)
  }, [])

  return shouldShow
}
