import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSetting } from '../utils/db'

// ─── ANIMATED FLUX LOGO SVG ────────────────────────────────────────────────────
function FluxLogo({ size = 120 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sb" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#bae6fd"/>
          <stop offset="45%" stopColor="#38bdf8"/>
          <stop offset="100%" stopColor="#0284c7"/>
        </radialGradient>
        <radialGradient id="sg" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff"/>
          <stop offset="100%" stopColor="#e0f2fe"/>
        </radialGradient>
        <filter id="sf" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2"/>
        </filter>
      </defs>
      {/* Outer glow */}
      <ellipse cx="60" cy="65" rx="42" ry="44" fill="#38bdf8" opacity="0.15" filter="url(#sf)"/>
      {/* Body */}
      <ellipse cx="60" cy="67" rx="38" ry="40" fill="url(#sb)"/>
      {/* Shimmer */}
      <ellipse cx="46" cy="52" rx="10" ry="6" fill="white" opacity="0.28" transform="rotate(-20,46,52)"/>
      {/* Eyes */}
      <ellipse cx="46" cy="61" rx="8" ry="9" fill="url(#sg)"/>
      <ellipse cx="74" cy="61" rx="8" ry="9" fill="url(#sg)"/>
      <circle cx="47" cy="62" r="5" fill="#075985"/>
      <circle cx="75" cy="62" r="5" fill="#075985"/>
      <circle cx="49" cy="60" r="2" fill="white"/>
      <circle cx="77" cy="60" r="2" fill="white"/>
      {/* Smile */}
      <path d="M49 77 Q60 87 71 77" fill="none" stroke="#0369a1" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Antennae */}
      <line x1="50" y1="28" x2="43" y2="16" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="42" cy="14" r="4" fill="#bae6fd"/>
      <line x1="70" y1="28" x2="77" y2="16" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="78" cy="14" r="4" fill="#bae6fd"/>
      {/* Water ripples at base */}
      <ellipse cx="60" cy="105" rx="25" ry="4" fill="#38bdf8" opacity="0.15"/>
      <ellipse cx="60" cy="108" rx="18" ry="3" fill="#38bdf8" opacity="0.08"/>
    </svg>
  )
}

// ─── ANIMATED WATER RING ───────────────────────────────────────────────────────
function WaterRing({ delay = 0, size = 200, opacity = 0.15 }) {
  return (
    <div className="absolute rounded-full border pointer-events-none"
      style={{
        width: size, height: size,
        borderColor: `rgba(34,211,238,${opacity})`,
        animation: `splashRing 3s ease-out ${delay}s infinite`,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }}/>
  )
}

export default function Splash() {
  const [phase, setPhase] = useState('logo')   // logo | tagline | brand | exit
  const [done,  setDone]  = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Orchestrate the splash sequence
    const t1 = setTimeout(() => setPhase('tagline'), 900)
    const t2 = setTimeout(() => setPhase('brand'),   1800)
    const t3 = setTimeout(() => setPhase('exit'),    3200)
    const t4 = setTimeout(async () => {
      setDone(true)
      const onboarded = await getSetting('onboarded', false)
      navigate(onboarded ? '/home' : '/onboarding', { replace: true })
    }, 3900)

    return () => [t1,t2,t3,t4].forEach(clearTimeout)
  }, [])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 80% 80% at 50% 40%, #0a1628 0%, #05080f 100%)',
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.7s ease-in-out',
      }}
    >
      <style>{`
        @keyframes splashRing {
          0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(1);   opacity: 0; }
        }
        @keyframes logoRise {
          0%   { transform: translateY(30px) scale(0.8); opacity: 0; filter: blur(8px); }
          60%  { filter: blur(0); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes textReveal {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes devReveal {
          0%   { opacity: 0; transform: translateY(8px); letter-spacing: 0.1em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.22em; }
        }
        @keyframes shimmerText {
          0%,100% { background-position: -200% center; }
          50%      { background-position: 200% center; }
        }
        @keyframes floatLogo {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
      `}</style>

      {/* Water rings */}
      {phase !== 'logo' && (
        <>
          <WaterRing delay={0}   size={220} opacity={0.12}/>
          <WaterRing delay={0.4} size={300} opacity={0.07}/>
          <WaterRing delay={0.8} size={380} opacity={0.04}/>
        </>
      )}

      {/* Central content */}
      <div className="flex flex-col items-center gap-5 relative z-10">

        {/* Logo */}
        <div style={{
          animation: 'logoRise 0.8s cubic-bezier(0.16,1,0.3,1) both, floatLogo 4s ease-in-out 1s infinite',
          filter: 'drop-shadow(0 0 24px rgba(34,211,238,0.4)) drop-shadow(0 0 48px rgba(34,211,238,0.15))',
        }}>
          <FluxLogo size={130}/>
        </div>

        {/* App name */}
        <div style={{
          opacity: phase === 'logo' ? 0 : 1,
          animation: phase !== 'logo' ? 'textReveal 0.6s cubic-bezier(0.16,1,0.3,1) both' : 'none',
        }}>
          <h1 style={{
            fontFamily: '"Syne", sans-serif',
            fontSize: '42px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #fff 0%, #22d3ee 45%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1,
          }}>
            YoSpeech
          </h1>
        </div>

        {/* Tagline */}
        <div style={{
          opacity: phase === 'logo' || phase === 'tagline' ? 0 : 0.6,
          animation: phase === 'brand' || phase === 'exit' ? 'textReveal 0.5s ease both' : 'none',
          animationDelay: '0.1s',
        }}>
          <p style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '15px',
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.08em',
            textAlign: 'center',
          }}>
            Find Your Flow
          </p>
        </div>

        {/* Divider */}
        <div style={{
          width: phase === 'brand' || phase === 'exit' ? '120px' : '0px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)',
          transition: 'width 0.6s ease',
        }}/>

        {/* Developer name */}
        <div style={{
          opacity: phase === 'brand' || phase === 'exit' ? 1 : 0,
          animation: phase === 'brand' || phase === 'exit' ? 'devReveal 0.7s cubic-bezier(0.16,1,0.3,1) both' : 'none',
          animationDelay: '0.2s',
        }}>
          <p style={{
            fontFamily: '"Syne", sans-serif',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            background: 'linear-gradient(90deg, rgba(34,211,238,0.5), rgba(167,139,250,0.8), rgba(34,211,238,0.5))',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmerText 3s linear infinite',
          }}>
            SayMyTech Developers
          </p>
        </div>
      </div>

      {/* Corner version */}
      <div className="absolute bottom-8 right-6" style={{
        opacity: phase === 'brand' || phase === 'exit' ? 0.2 : 0,
        transition: 'opacity 0.4s ease',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.5)',
      }}>
        v2.0
      </div>
    </div>
  )
}
