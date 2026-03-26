import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSetting, setSetting, getProfile } from '../utils/db'
import Flux from '../components/flux/Flux'

// ─── SIMPLE LOCAL AUTH ─────────────────────────────────────────────────────────
// The app works fully offline with local data.
// "Sign in" here means creating a named session — no server needed.
// Optional: future Supabase integration can be dropped in here.

const TAGLINES = [
  'Your voice. Your flow. Your journey.',
  'Built for every voice. Every story.',
  'Where stutters become superpowers.',
  'Communication mastery for the brave.',
]

export default function Auth() {
  const [view, setView]         = useState('landing') // landing | signin | signup
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [tagline]               = useState(TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
  const navigate = useNavigate()

  // For now: local auth (no server). Just saves a session token locally.
  // Swap this for real Supabase calls when backend is ready.
  const handleContinueLocal = async () => {
    // Skip auth entirely — go straight to onboarding or home
    const onboarded = await getSetting('onboarded', false)
    const profile   = await getProfile()
    if (onboarded && profile) {
      navigate('/home', { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
  }

  const handleSignIn = async (e) => {
    e?.preventDefault()
    if (!email.trim()) { setError('Please enter your email'); return }
    setLoading(true); setError('')
    try {
      // Local session for now
      await setSetting('user_email', email.trim())
      await setSetting('auth_method', 'local')
      const onboarded = await getSetting('onboarded', false)
      navigate(onboarded ? '/home' : '/onboarding', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const handleSignUp = async (e) => {
    e?.preventDefault()
    if (!email.trim()) { setError('Please enter your email'); return }
    setLoading(true); setError('')
    try {
      await setSetting('user_email', email.trim())
      await setSetting('auth_method', 'local')
      navigate('/onboarding', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 100% 80% at 50% 0%, #0d1b2e 0%, #05080f 60%)' }}>

      <style>{`
        @keyframes authFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-15px) scale(1.1)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-15px,20px) scale(0.9)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background:'radial-gradient(circle, rgba(34,211,238,0.1), transparent 70%)', animation:'orb1 8s ease-in-out infinite' }}/>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background:'radial-gradient(circle, rgba(167,139,250,0.08), transparent 70%)', animation:'orb2 10s ease-in-out infinite' }}/>

      <div className="flex-1 flex flex-col items-center justify-between px-6 py-12 relative z-10 max-w-sm mx-auto w-full">

        {/* ── Landing ── */}
        {view === 'landing' && (
          <div className="w-full flex flex-col items-center gap-6" style={{ animation:'fadeUp 0.6s ease both' }}>
            <div style={{ animation:'authFloat 4s ease-in-out infinite', filter:'drop-shadow(0 0 30px rgba(34,211,238,0.35))' }}>
              <Flux size={120} ageGroup="explorer" mood="happy" floating={false}/>
            </div>

            <div className="text-center">
              <h1 style={{ fontFamily:'"Syne",sans-serif', fontSize:'38px', fontWeight:800, lineHeight:1.1,
                background:'linear-gradient(135deg,#fff 0%,#22d3ee 50%,#a78bfa 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                YoSpeech
              </h1>
              <p className="mt-3 text-sm leading-relaxed" style={{ color:'rgba(255,255,255,0.5)', fontFamily:'"DM Sans",sans-serif' }}>
                {tagline}
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 justify-center">
              {['💧 Stutter Therapy','🎙️ Comm Coaching','🤖 AI Companion','📴 Works Offline'].map(f => (
                <span key={f} style={{
                  fontFamily:'"Syne",sans-serif', fontSize:'11px', fontWeight:600,
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                  color:'rgba(255,255,255,0.6)', padding:'5px 12px', borderRadius:'99px',
                }}>{f}</span>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="w-full space-y-3 mt-2">
              <button onClick={() => setView('signup')} style={{
                width:'100%', padding:'16px', borderRadius:'16px', fontFamily:'"Syne",sans-serif',
                fontWeight:700, fontSize:'16px', background:'var(--aqua)', color:'#05080f',
                boxShadow:'0 4px 24px rgba(34,211,238,0.35)', border:'none', cursor:'pointer',
                transition:'all 0.2s', transform:'scale(1)',
              }}>
                Create Free Account
              </button>
              <button onClick={() => setView('signin')} style={{
                width:'100%', padding:'14px', borderRadius:'16px', fontFamily:'"Syne",sans-serif',
                fontWeight:600, fontSize:'14px', background:'rgba(255,255,255,0.06)',
                color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer',
              }}>
                I already have an account
              </button>
              <button onClick={handleContinueLocal} style={{
                width:'100%', padding:'10px', background:'none', border:'none', cursor:'pointer',
                fontFamily:'"DM Sans",sans-serif', fontSize:'13px', color:'rgba(255,255,255,0.3)',
              }}>
                Continue without account →
              </button>
            </div>

            {/* SayMyTech credit */}
            <div className="mt-4 text-center">
              <p style={{ fontSize:'10px', letterSpacing:'0.18em', textTransform:'uppercase', fontFamily:'"Syne",sans-serif',
                background:'linear-gradient(90deg, rgba(34,211,238,0.4), rgba(167,139,250,0.7), rgba(34,211,238,0.4))',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                SayMyTech Developers
              </p>
            </div>
          </div>
        )}

        {/* ── Sign Up ── */}
        {view === 'signup' && (
          <div className="w-full" style={{ animation:'fadeUp 0.4s ease both' }}>
            <button onClick={() => setView('landing')} style={{ background:'none', border:'none', cursor:'pointer',
              color:'rgba(255,255,255,0.4)', fontFamily:'"Syne",sans-serif', fontSize:'13px', marginBottom:'24px' }}>
              ← Back
            </button>

            <div className="flex justify-center mb-6">
              <Flux size={72} ageGroup="explorer" mood="happy" floating={false}
                style={{ filter:'drop-shadow(0 0 20px rgba(34,211,238,0.3))' }}/>
            </div>

            <h2 style={{ fontFamily:'"Syne",sans-serif', fontSize:'26px', fontWeight:700,
              color:'white', marginBottom:'6px', textAlign:'center' }}>
              Start Your Journey
            </h2>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px', textAlign:'center', marginBottom:'28px', fontFamily:'"DM Sans",sans-serif' }}>
              Free forever · No credit card · Works offline
            </p>

            <form onSubmit={handleSignUp} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="Your email" required
                style={{ padding:'14px 16px', borderRadius:'14px', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.12)', color:'white', fontSize:'15px',
                  fontFamily:'"DM Sans",sans-serif', outline:'none',
                  transition:'border-color 0.2s' }}
                onFocus={e=>e.target.style.borderColor='rgba(34,211,238,0.5)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}
              />
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Create a password"
                style={{ padding:'14px 16px', borderRadius:'14px', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.12)', color:'white', fontSize:'15px',
                  fontFamily:'"DM Sans",sans-serif', outline:'none',
                  transition:'border-color 0.2s' }}
                onFocus={e=>e.target.style.borderColor='rgba(34,211,238,0.5)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}
              />
              {error && <p style={{ color:'#fb7185', fontSize:'12px', fontFamily:'"DM Sans",sans-serif' }}>{error}</p>}
              <button type="submit" disabled={loading}
                style={{ padding:'16px', borderRadius:'14px', background:'var(--aqua)', color:'#05080f',
                  fontFamily:'"Syne",sans-serif', fontWeight:700, fontSize:'16px', border:'none', cursor:'pointer',
                  opacity: loading ? 0.6 : 1, boxShadow:'0 4px 24px rgba(34,211,238,0.3)' }}>
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>

            <p style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:'11px', marginTop:'20px',
              fontFamily:'"DM Sans",sans-serif', lineHeight:1.6 }}>
              By continuing you agree to our terms. Your data stays on your device.
            </p>

            <button onClick={() => setView('signin')} style={{ background:'none', border:'none', cursor:'pointer',
              color:'rgba(255,255,255,0.4)', fontFamily:'"DM Sans",sans-serif', fontSize:'13px',
              display:'block', margin:'16px auto 0', textDecoration:'underline' }}>
              Already have an account? Sign in
            </button>
          </div>
        )}

        {/* ── Sign In ── */}
        {view === 'signin' && (
          <div className="w-full" style={{ animation:'fadeUp 0.4s ease both' }}>
            <button onClick={() => setView('landing')} style={{ background:'none', border:'none', cursor:'pointer',
              color:'rgba(255,255,255,0.4)', fontFamily:'"Syne",sans-serif', fontSize:'13px', marginBottom:'24px' }}>
              ← Back
            </button>

            <h2 style={{ fontFamily:'"Syne",sans-serif', fontSize:'26px', fontWeight:700,
              color:'white', marginBottom:'6px', textAlign:'center' }}>
              Welcome Back
            </h2>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px', textAlign:'center', marginBottom:'28px', fontFamily:'"DM Sans",sans-serif' }}>
              Your progress has been waiting for you
            </p>

            <form onSubmit={handleSignIn} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="Email" required
                style={{ padding:'14px 16px', borderRadius:'14px', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.12)', color:'white', fontSize:'15px',
                  fontFamily:'"DM Sans",sans-serif', outline:'none' }}
                onFocus={e=>e.target.style.borderColor='rgba(34,211,238,0.5)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}
              />
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Password"
                style={{ padding:'14px 16px', borderRadius:'14px', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.12)', color:'white', fontSize:'15px',
                  fontFamily:'"DM Sans",sans-serif', outline:'none' }}
                onFocus={e=>e.target.style.borderColor='rgba(34,211,238,0.5)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.12)'}
              />
              {error && <p style={{ color:'#fb7185', fontSize:'12px', fontFamily:'"DM Sans",sans-serif' }}>{error}</p>}
              <button type="submit" disabled={loading}
                style={{ padding:'16px', borderRadius:'14px', background:'var(--aqua)', color:'#05080f',
                  fontFamily:'"Syne",sans-serif', fontWeight:700, fontSize:'16px', border:'none', cursor:'pointer',
                  opacity: loading ? 0.6 : 1, boxShadow:'0 4px 24px rgba(34,211,238,0.3)' }}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>

            <button onClick={() => setView('signup')} style={{ background:'none', border:'none', cursor:'pointer',
              color:'rgba(255,255,255,0.4)', fontFamily:'"DM Sans",sans-serif', fontSize:'13px',
              display:'block', margin:'16px auto 0', textDecoration:'underline' }}>
              Don't have an account? Sign up
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
