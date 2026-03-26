import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../hooks/useAppContext'

// ─── FLUX SVG CHARACTER ────────────────────────────────────────────────────────
const FluxSVG = ({ ageGroup = 'explorer', size = 120, mood = 'happy', speaking = false }) => {
  const colors = {
    little: { body: '#38bdf8', glow: '#7dd3fc', accent: '#e0f2fe' },
    explorer: { body: '#0ea5e9', glow: '#38bdf8', accent: '#bae6fd' },
    navigator: { body: '#6366f1', glow: '#818cf8', accent: '#c7d2fe' },
    adult: { body: '#8b5cf6', glow: '#a78bfa', accent: '#ede9fe' },
  }[ageGroup] || { body: '#0ea5e9', glow: '#38bdf8', accent: '#bae6fd' }

  const moodScale = { happy: 1, excited: 1.1, calm: 0.95, thinking: 1, sad: 0.9 }[mood] || 1

  if (ageGroup === 'navigator' || ageGroup === 'adult') {
    // Geometric form for older users
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
        style={{ filter: `drop-shadow(0 0 ${speaking ? 16 : 8}px ${colors.glow})` }}>
        <defs>
          <radialGradient id="geoGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={colors.glow} />
            <stop offset="100%" stopColor={colors.body} />
          </radialGradient>
        </defs>
        <polygon points="50,10 85,75 15,75" fill="url(#geoGrad)" opacity="0.9">
          {speaking && <animateTransform attributeName="transform" type="scale" values="1;1.05;1"
            dur="0.5s" repeatCount="indefinite" additive="sum" transformOrigin="50 50"/>}
        </polygon>
        <polygon points="50,90 15,30 85,30" fill={colors.body} opacity="0.4"/>
        <circle cx="50" cy="52" r="12" fill={colors.accent} opacity="0.9"/>
        {mood === 'happy' && <path d="M43,50 Q50,57 57,50" fill="none" stroke={colors.body} strokeWidth="2" strokeLinecap="round"/>}
        {mood === 'thinking' && <circle cx="50" cy="52" r="3" fill={colors.body}/>}
      </svg>
    )
  }

  // Organic round form for younger users
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: `drop-shadow(0 0 ${speaking ? 20 : 10}px ${colors.glow})` }}>
      <defs>
        <radialGradient id="fluxGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={colors.accent} />
          <stop offset="50%" stopColor={colors.glow} />
          <stop offset="100%" stopColor={colors.body} />
        </radialGradient>
        <radialGradient id="eyeGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </radialGradient>
      </defs>

      {/* Body */}
      <ellipse cx="50" cy="55" rx="36" ry="38" fill="url(#fluxGrad)">
        {speaking && <animate attributeName="ry" values="38;42;38" dur="0.6s" repeatCount="indefinite"/>}
        {speaking && <animate attributeName="rx" values="36;32;36" dur="0.6s" repeatCount="indefinite"/>}
      </ellipse>

      {/* Shimmer */}
      <ellipse cx="38" cy="42" rx="8" ry="5" fill="white" opacity="0.3" transform="rotate(-20,38,42)"/>

      {/* Eyes */}
      <ellipse cx="38" cy="50" rx="7" ry="8" fill="url(#eyeGrad)"/>
      <ellipse cx="62" cy="50" rx="7" ry="8" fill="url(#eyeGrad)"/>
      <circle cx="39" cy="51" r="4" fill="#0369a1"/>
      <circle cx="63" cy="51" r="4" fill="#0369a1"/>
      <circle cx="40" cy="49" r="1.5" fill="white"/>
      <circle cx="64" cy="49" r="1.5" fill="white"/>

      {/* Expression */}
      {mood === 'happy' && <path d="M40,64 Q50,73 60,64" fill="none" stroke={colors.body} strokeWidth="2.5" strokeLinecap="round"/>}
      {mood === 'excited' && <path d="M38,63 Q50,75 62,63" fill="none" stroke={colors.body} strokeWidth="3" strokeLinecap="round"/>}
      {mood === 'calm' && <line x1="42" y1="66" x2="58" y2="66" stroke={colors.body} strokeWidth="2" strokeLinecap="round"/>}
      {mood === 'sad' && <path d="M40,68 Q50,62 60,68" fill="none" stroke={colors.body} strokeWidth="2" strokeLinecap="round"/>}

      {/* Antennae */}
      <line x1="42" y1="18" x2="36" y2="8" stroke={colors.glow} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="35" cy="7" r="2.5" fill={colors.accent}/>
      <line x1="58" y1="18" x2="64" y2="8" stroke={colors.glow} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="65" cy="7" r="2.5" fill={colors.accent}/>

      {/* Blinking animation */}
      <ellipse cx="38" cy="50" rx="7" ry="0" fill={colors.glow} opacity="0.9">
        <animate attributeName="ry" values="0;8;0" dur="4s" begin="2s" repeatCount="indefinite"/>
      </ellipse>
      <ellipse cx="62" cy="50" rx="7" ry="0" fill={colors.glow} opacity="0.9">
        <animate attributeName="ry" values="0;8;0" dur="4s" begin="2.1s" repeatCount="indefinite"/>
      </ellipse>

      {/* Water droplets */}
      {speaking && <>
        <circle cx="20" cy="45" r="3" fill={colors.glow} opacity="0.6">
          <animate attributeName="cx" values="20;10;20" dur="1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="80" cy="50" r="2.5" fill={colors.glow} opacity="0.6">
          <animate attributeName="cx" values="80;90;80" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      </>}
    </svg>
  )
}

// ─── FLUX MESSAGE BUBBLE ──────────────────────────────────────────────────────
export const FluxBubble = ({ message, visible, ageGroup }) => {
  if (!visible || !message) return null
  return (
    <div className="animate-slide-up flex gap-3 items-start max-w-sm">
      <div className="flex-shrink-0 mt-1">
        <FluxSVG ageGroup={ageGroup} size={48} mood="happy" speaking />
      </div>
      <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-white/90">
        {message}
        <div className="absolute -left-2 top-3 w-0 h-0
          border-t-[8px] border-t-transparent
          border-r-[8px] border-r-white/10
          border-b-[8px] border-b-transparent" />
      </div>
    </div>
  )
}

// ─── MAIN FLUX COMPONENT ──────────────────────────────────────────────────────
export default function Flux({
  size = 120,
  ageGroup = 'explorer',
  mood = 'happy',
  speaking = false,
  floating = true,
  showMessage = false,
  message = '',
  onClick,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`cursor-pointer select-none ${floating ? 'animate-flux-float' : ''} ${speaking ? 'animate-flux-pulse' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        <FluxSVG ageGroup={ageGroup} size={size} mood={mood} speaking={speaking} />
      </div>

      {showMessage && message && (
        <div className="animate-slide-up max-w-[260px] glass rounded-2xl px-4 py-3 text-center text-sm text-white/90 leading-relaxed">
          {message}
        </div>
      )}
    </div>
  )
}

export { FluxSVG }

// ─── GLOBAL FLUX SPEAK BUTTON ─────────────────────────────────────────────────
// Can be dropped anywhere to give Flux a voice for any text
import { speakFlux, stopSpeaking, ttsAvailable } from '../../ai/voiceEngine'

export function FluxSpeakBtn({ text, ageGroup = 'explorer', label = '🔊', className = '' }) {
  const [active, setActive] = useState(false)
  if (!ttsAvailable()) return null
  const toggle = () => {
    if (active) { stopSpeaking(); setActive(false) }
    else {
      setActive(true)
      speakFlux(text, ageGroup, { onEnd: () => setActive(false) })
    }
  }
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display transition-all active:scale-90
        ${active ? 'bg-flow-400 text-white animate-pulse' : 'rgba(255,255,255,0.08) text-white/50 hover:bg-white/15'} ${className}`}
    >
      {active ? '⏹ Stop' : `${label} Read aloud`}
    </button>
  )
}
