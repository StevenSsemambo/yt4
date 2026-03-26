import { useState, useCallback, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../../hooks/useAppContext'
import { speak, stopSpeaking, isSpeaking } from '../../ai/voiceEngine'

// ─── PAGE CONTENT MAP ────────────────────────────────────────────────────────
// Every route gets a readable summary so Flux can describe what's on the page.
// Dynamic values (name, streak etc.) are filled in at read time via profile.
const PAGE_SCRIPTS = {
  '/home': (p, stats) => `
    Welcome to your Home dashboard, ${p?.name || 'friend'}.
    You have completed ${stats?.sessions || 0} sessions total and your current streak is ${stats?.streak || 0} days.
    From here you can access all your speech tools: Breathe for calming exercises, SpeakLab for daily speech practice,
    BraveMissions for facing your speaking fears, Voice Journal to record your thoughts,
    FluentPath for your personalised progress roadmap, MindShift for mindset coaching,
    StutterScore to track your fluency, NeuroBrain to learn about stuttering science,
    and Voice Lab for advanced vocal technique skills.
    You can also chat directly with me, your AI companion Flux, at any time.
    Tap any card on the screen to begin a session.
  `,
  '/adventure': (p) => `
    This is Adventure Mode, ${p?.name || 'friend'}.
    You have a world map with six zones to explore: the Forest of First Words, the Mountain of Momentum,
    the Ocean of Openness, the City of Courage, the Sky of Spontaneity, and the Summit of Self.
    Each zone has five missions that teach different speech fluency techniques.
    Complete missions to earn stars and unlock new zones.
    Your goal is to work through all thirty missions and reach the Summit of Self.
  `,
  '/comm': (p) => `
    This is Communication Academy, ${p?.name || 'friend'}.
    Here you practice real-world speaking scenarios including job interviews, presentations, phone calls,
    storytelling, and social conversations.
    Each scenario gives you structured coaching and feedback from Flux.
    Start with the scenario that feels most relevant to you right now.
  `,
  '/breathe': (p) => `
    Welcome to Breathe and Flow, ${p?.name || 'friend'}.
    This section has four breathing exercises designed to calm your nervous system before speaking.
    Box Breathing guides you through four counts in, hold, out, and hold again.
    The Four Seven Eight technique uses longer holds to activate your body's calm response.
    Resonant Breathing finds your natural breathing rhythm at around five to six breaths per minute.
    Pursed Lip Breathing slows your exhale to release tension.
    Pick the exercise that feels right, follow the visual guide, and breathe with me.
  `,
  '/speaklab': (p) => `
    This is SpeakLab, your daily speech practice space, ${p?.name || 'friend'}.
    You have four exercises available today.
    Soft Onset training helps you start words gently without tension.
    Easy Onset practice teaches you to ease into sounds instead of forcing them.
    Prolongation drills slow down your speech deliberately to build control.
    Light Articulatory Contact reduces the pressure your lips and tongue use when making sounds.
    Complete all four exercises to earn today's session star.
  `,
  '/brave': (p) => `
    Welcome to BraveMissions, ${p?.name || 'friend'}.
    This is where you face your speaking fears deliberately — which is one of the most powerful things you can do.
    The Fear Ladder lets you add speaking situations from easiest to hardest, then tackle them one step at a time.
    Voluntary Stuttering missions let you choose to stutter on purpose — removing the fear of it happening unexpectedly.
    Role-play scenarios let you practice difficult conversations with Flux as your scene partner.
    Every brave action earns you a brave star. You are building real courage here.
  `,
  '/talktales': (p) => `
    This is TalkTales, ${p?.name || 'friend'}.
    Here you and Flux create stories together with no pressure and no judgment.
    Flux starts a story and you continue it however you like. There is no wrong answer.
    Storytelling builds fluency, imagination, and confidence at the same time.
    Just speak or type your part of the story and Flux will carry it forward.
  `,
  '/journal': (p) => `
    This is your Voice Journal, ${p?.name || 'friend'}.
    Each entry is a thirty second recording of your thoughts, your wins, or whatever is on your mind.
    You can also log your mood for today.
    Listening back to your own recordings over time is one of the most powerful ways to see your progress.
    Press the microphone button to start recording.
  `,
  '/family': (p) => `
    Welcome to Family Mode, ${p?.name || 'friend'}.
    This section helps parents and family members support you in the best possible way.
    You will find co-reading exercises where a family member reads alongside you, which research shows can improve fluency by up to ninety seven percent.
    There are also coaching tips for parents on what to say, what not to say, and how to create a supportive environment at home.
    Share this section with someone you trust.
  `,
  '/progress': (p) => `
    This is your Progress Universe, ${p?.name || 'friend'}.
    Your journey is visualised as a star sky — every session you complete adds a star.
    You can earn fifteen achievements as you reach milestones in your practice.
    Your Flux companion also evolves as you progress, reflecting how far you have come.
    Keep going — every single session matters.
  `,
  '/flux-chat': (p) => `
    This is Flux Chat, ${p?.name || 'friend'}.
    I am your AI companion powered by Claude, and I am here to talk about anything.
    You can speak to me using your microphone or type your message.
    I know your history, your goals, and your progress. Nothing you share here will surprise me.
    I am not just a chatbot — I am a guide who genuinely wants you to find your voice.
    What would you like to talk about?
  `,
  '/mindshift': (p) => `
    Welcome to MindShift, ${p?.name || 'friend'}.
    This section uses Cognitive Behavioural Therapy techniques to help you change how you think about speaking.
    You will work through thought records that identify unhelpful beliefs, challenge them, and replace them with more balanced ones.
    MindShift also includes acceptance exercises from ACT — Acceptance and Commitment Therapy.
    Your mindset is as important as your technique. This is where you work on both.
  `,
  '/stutterscore': (p) => `
    This is StutterScore, ${p?.name || 'friend'}.
    Here you track your own fluency across different dimensions: physical tension, avoidance, impact on daily life, and overall confidence.
    Self-assessment is more accurate than any external measure because you experience your speech from the inside.
    Your scores are tracked over time so you can see real trends and celebrate real progress.
    Be honest with yourself — this data is just for you.
  `,
  '/fluentpath': (p) => `
    This is FluentPath, your personalised roadmap, ${p?.name || 'friend'}.
    Based on your sessions, your fear ladder, and your goals, Flux has mapped out the most effective path forward for you specifically.
    You have drills, milestones, and weekly targets laid out in order of priority.
    Follow the path or jump to whatever feels most important today.
  `,
  '/neurobrain': (p) => `
    Welcome to NeuroBrain, ${p?.name || 'friend'}.
    This section explains the science of stuttering in plain language.
    You will learn how the brain processes speech, why stuttering happens neurologically, and what the research says about therapy techniques.
    Understanding what is actually happening in your brain changes the relationship you have with your speech.
    Knowledge reduces shame. Start with any topic that interests you.
  `,
  '/voicelab': (p) => `
    This is Voice Lab, ${p?.name || 'friend'}.
    You have six vocal skills to develop here: Pitch Control, Pacing and Rhythm, Resonance and Projection,
    Breath Support, Articulation Precision, and Vocal Confidence Under Pressure.
    Each skill has guided exercises, real-time feedback, and scoring.
    A strong voice is not just about fluency — it is about presence and confidence.
    Pick a skill and start training.
  `,
  '/settings': (p) => `
    This is your Settings page, ${p?.name || 'friend'}.
    Here you can update your name, age group, and practice mode.
    You can also clear your session history or reset your profile if needed.
    Your data lives on your device and is never shared.
  `,
  '/onboarding': () => `
    Welcome to YoSpeech. I am Flux, your speech companion.
    Let's get you set up. You will choose your age group, your practice mode — either Stutter Confidence or Communication Coach — and your name.
    This takes about one minute.
  `,
}

const HIDDEN_ROUTES = ['/', '/auth', '/onboarding', '/flux-chat']

export default function AudioReader() {
  const location = useLocation()
  const { profile, streak, totalSessions } = useApp()
  const [reading, setReading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const panelRef = useRef(null)
  const route = location.pathname

  // Hide on routes that have their own audio or don't need a reader
  if (HIDDEN_ROUTES.includes(route)) return null

  const getScript = useCallback(() => {
    const scriptFn = PAGE_SCRIPTS[route]
    if (!scriptFn) {
      return `You are on the ${route.replace('/', '').replace('-', ' ')} page of YoSpeech. Tap around to explore what's here.`
    }
    return scriptFn(profile, { sessions: totalSessions, streak })
      .replace(/\n\s+/g, ' ')   // collapse whitespace from template literals
      .replace(/\s{2,}/g, ' ')
      .trim()
  }, [route, profile, totalSessions, streak])

  const handleRead = useCallback(() => {
    if (reading) {
      stopSpeaking()
      setReading(false)
      setExpanded(false)
      return
    }
    const script = getScript()
    setReading(true)
    speak(script, {
      ageGroup: profile?.ageGroup || 'explorer',
      onEnd: () => setReading(false),
    })
  }, [reading, getScript, profile])

  // Close panel if user taps outside
  useEffect(() => {
    if (!expanded) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [expanded])

  // Stop reading on route change
  useEffect(() => {
    stopSpeaking()
    setReading(false)
    setExpanded(false)
  }, [route])

  return (
    <>
      {/* Expanded panel */}
      {expanded && (
        <div
          ref={panelRef}
          className="fixed z-50 glass-dark rounded-3xl p-4"
          style={{
            bottom: '90px',
            right: '16px',
            left: '16px',
            maxWidth: '400px',
            margin: '0 auto',
            border: '1px solid rgba(34,211,238,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'rgba(34,211,238,0.15)' }}
            >
              🎧
            </div>
            <div>
              <p className="text-white font-semibold text-sm" style={{ fontFamily: '"Syne",sans-serif' }}>
                Flux Audio Reader
              </p>
              <p className="text-white/40 text-xs">
                {reading ? 'Reading this page aloud…' : 'Let Flux read this page to you'}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRead}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
              style={{
                background: reading ? 'rgba(251,113,133,0.15)' : 'var(--aqua)',
                color: reading ? 'var(--rose)' : '#05080f',
                border: reading ? '1px solid rgba(251,113,133,0.3)' : 'none',
                fontFamily: '"Syne",sans-serif',
              }}
            >
              {reading ? '⏹ Stop Reading' : '▶ Read This Page'}
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="w-12 rounded-2xl flex items-center justify-center transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="text-white/40 text-lg">✕</span>
            </button>
          </div>

          {reading && (
            <div className="mt-3 flex items-center gap-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="flex-1 rounded-full"
                  style={{
                    height: `${8 + Math.random() * 16}px`,
                    background: 'var(--aqua)',
                    opacity: 0.6 + Math.random() * 0.4,
                    animation: `recordBlink ${0.4 + i * 0.1}s ease-in-out infinite`,
                    animationDelay: `${i * 0.07}s`,
                  }}
                />
              ))}
              <span className="text-white/30 text-xs ml-1">live</span>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => {
          if (reading) {
            stopSpeaking()
            setReading(false)
            setExpanded(false)
          } else {
            setExpanded(v => !v)
          }
        }}
        className="fixed z-50 flex items-center justify-center transition-all active:scale-90"
        style={{
          bottom: '90px',
          right: '16px',
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          background: reading
            ? 'rgba(251,113,133,0.2)'
            : expanded
              ? 'rgba(34,211,238,0.25)'
              : 'rgba(34,211,238,0.12)',
          border: reading
            ? '1px solid rgba(251,113,133,0.4)'
            : '1px solid rgba(34,211,238,0.3)',
          backdropFilter: 'blur(12px)',
          boxShadow: reading
            ? '0 4px 20px rgba(251,113,133,0.2)'
            : '0 4px 20px rgba(34,211,238,0.15)',
          // When expanded panel is open, hide the button (panel replaces it)
          display: expanded ? 'none' : 'flex',
        }}
        aria-label="Audio reader"
      >
        <span style={{ fontSize: '20px', lineHeight: 1 }}>
          {reading ? '⏹' : '🎧'}
        </span>
      </button>
    </>
  )
}
