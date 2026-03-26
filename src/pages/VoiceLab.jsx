import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak, getSetting, setSetting } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import {
  analyzeCommSkill, getOfflineResponse, updateMemoryAfterSession,
  analyzeFillerWords, analyzeStorytelling, analyzeActiveListening,
  generateImpromptTopic,
  PAUSE_TRAINER_PROMPTS, PAUSE_TRAINER_FILLER_WORDS, analyzePauseTrainer,
  PRESENTATION_LAB_DRILLS, analyzePresentationDrill,
} from '../ai/fluxEngine'
import { speak, ttsAvailable } from '../ai/voiceEngine'
import useFluxVoice from '../hooks/useFluxVoice'
import Flux from '../components/flux/Flux'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'warmup',     label: 'Vocal Warm-Up',    icon: '🎵', color: 'from-cyan-500/20 to-sky-600/20',       border: 'border-cyan-500/25',    pill: 'pill-aqua'   },
  { id: 'filler',     label: 'Filler Detector',  icon: '🚫', color: 'from-rose-500/20 to-pink-600/20',      border: 'border-rose-500/25',    pill: 'pill-rose'   },
  { id: 'story',      label: 'Story Studio',     icon: '📖', color: 'from-amber-500/20 to-orange-600/20',   border: 'border-amber-500/25',   pill: 'pill-amber'  },
  { id: 'listening',  label: 'Listening Lab',    icon: '👂', color: 'from-jade-500/20 to-emerald-600/20',   border: 'border-jade-500/25',    pill: 'pill-jade'   },
  { id: 'presence',   label: 'Body Language',    icon: '🧍', color: 'from-violet-500/20 to-purple-600/20',  border: 'border-violet-500/25',  pill: 'pill-violet' },
  { id: 'impromptu',  label: 'Impromptu',        icon: '⚡', color: 'from-amber-500/20 to-yellow-600/20',   border: 'border-amber-500/25',   pill: 'pill-amber'  },
  { id: 'pause',      label: 'Pause Trainer',    icon: '⏸️', color: 'from-sky-500/20 to-cyan-600/20',       border: 'border-sky-500/25',     pill: 'pill-aqua'   },
  { id: 'preslab',    label: 'Presentation Lab', icon: '🎤', color: 'from-fuchsia-500/20 to-pink-600/20',   border: 'border-fuchsia-500/25', pill: 'pill-violet' },
]

// ── Warm-Up sequence ─────────────────────────────────────────────────────────
const WARMUP_STEPS = [
  {
    id: 'breathing', label: 'Diaphragmatic Breathing', duration: 60, icon: '💨',
    instruction: 'Place one hand on your belly. Breathe in through your nose for 4 counts — your belly should push OUT, not your chest. Hold 2 counts. Breathe out slowly for 6 counts. Repeat 5 times.',
    tip: 'This activates your diaphragm — the powerhouse of your voice. Chest breathing = shallow, weak voice. Belly breathing = resonant, controlled voice.',
  },
  {
    id: 'humming', label: 'Chest Resonance Hum', duration: 45, icon: '🎵',
    instruction: 'Close your lips loosely. Hum "mmmm" at the lowest comfortable pitch. Feel the vibration in your chest. Now slide the hum UP to a higher pitch, then back down. Do this 4 times.',
    tip: 'Humming warms up your vocal folds gently and builds chest resonance — the rich, warm quality that makes speakers sound authoritative.',
  },
  {
    id: 'lip_trills', label: 'Lip Trills', duration: 40, icon: '🫧',
    instruction: 'Blow air through loosely closed lips to create a "brrr" or motorboat sound. Now add your voice to it — "brrrrr" on a pitch. Do this going up and down like a siren for 30 seconds.',
    tip: 'Lip trills release tension in your lips, jaw, and throat. They\'re used by opera singers before performances.',
  },
  {
    id: 'tongue_twisters', label: 'Articulation Drills', duration: 60, icon: '👅',
    instruction: `Say each of these slowly and clearly, then faster:\n\n1. "Red lorry, yellow lorry, red lorry, yellow lorry"\n2. "Unique New York, unique New York, you know you need unique New York"\n3. "She sells seashells by the seashore"\n\nSlowly first — precision beats speed.`,
    tip: 'Articulation is about your tongue, lips, and jaw working precisely. Crisp consonants make every word land clearly.',
  },
  {
    id: 'projection', label: 'Vocal Projection', duration: 45, icon: '📢',
    instruction: 'Stand up if you can. Imagine speaking to someone 10 metres away. Take a breath from your belly, then say loudly and clearly: "Good morning! Thank you for being here today."\n\nNow imagine 50 people. Say it again — bigger, from the belly.',
    tip: 'Projection is breath-powered, not throat-powered. Pushing from the throat causes strain. Pushing from the belly keeps you clear and strong.',
  },
  {
    id: 'variety', label: 'Vocal Variety', duration: 45, icon: '🎭',
    instruction: 'Say this sentence three times — each time with a completely different feel:\n\n"And that was the moment everything changed."\n\n1st: Whisper it — intimate, like a secret\n2nd: Normal pace — conversational\n3rd: Slow and dramatic — maximum weight',
    tip: 'Varying pitch, pace, and volume keeps audiences engaged. Monotone is the enemy of attention.',
  },
]

// ── Storytelling frameworks ──────────────────────────────────────────────────
const STORY_EXERCISES = [
  {
    id: 'hook', title: 'The Hook', icon: '🎣', time: '30s',
    framework: 'Open with a hook — no introduction. Start in the middle of the action.',
    prompt: 'Tell a 30-second story that starts with: "The day everything changed was..." — dive straight in, no preamble.',
    scienceTip: 'Stanford research: audiences decide within 8 seconds whether to pay attention. Your opening is everything.',
    criteria: ['Starts immediately — no "Hi, today I want to tell you..."', 'Creates curiosity or tension in the first sentence', 'Specific details, not vague generalisations'],
  },
  {
    id: 'show_dont_tell', title: 'Show, Don\'t Tell', icon: '🖼️', time: '30s',
    framework: 'Paint a scene instead of reporting feelings.',
    prompt: 'Instead of saying "I was nervous", describe your body: the room, what you heard, what you physically felt. 30 seconds. Don\'t use the word "nervous" or "scared" once.',
    scienceTip: 'Sensory details activate the listener\'s brain as if they\'re experiencing it themselves. Abstract feelings don\'t.',
    criteria: ['Uses specific physical sensations', 'Describes the environment', 'Never says the emotion directly'],
  },
  {
    id: 'tension', title: 'Tension & Resolution', icon: '🌀', time: '45s',
    framework: 'Every good story: situation → complication → resolution → lesson.',
    prompt: 'Tell a 45-second story with this structure: Something was going well (situation). Then something went wrong (complication). You dealt with it (resolution). Here\'s what it taught you (lesson).',
    scienceTip: 'Dale Carnegie\'s formula: Incident → Action → Benefit. It\'s the tension-release pattern that makes stories memorable.',
    criteria: ['Clear 4-part structure', 'The complication creates real tension', 'Lesson adds meaning, not just summary'],
  },
  {
    id: 'callback', title: 'The Callback', icon: '🔄', time: '60s',
    framework: 'Start and end with the same detail — it creates a satisfying loop.',
    prompt: 'Tell a 60-second story. In your first sentence, mention a specific detail (an object, a place, a colour, a sound). In your final sentence, return to that exact detail. That\'s a callback — the most powerful story-closing tool.',
    scienceTip: 'Callbacks signal completion to the brain and make the story feel crafted, not just remembered.',
    criteria: ['Opening detail is specific and memorable', 'Story has a clear emotional arc', 'Callback in final sentence feels earned, not forced'],
  },
  {
    id: 'carnegie', title: 'Carnegie Formula', icon: '🎯', time: '45s',
    framework: 'Incident → Action → Benefit — the simplest persuasive story structure.',
    prompt: 'Pick a belief or habit you changed. Tell it in 3 parts: 1) What happened (incident) — be specific. 2) What you did about it (action). 3) What changed as a result (benefit). 45 seconds.',
    scienceTip: 'Carnegie trained over 7 million people using this exact formula. It works because it follows natural narrative logic.',
    criteria: ['Incident is concrete and relatable', 'Action shows agency and choice', 'Benefit is specific, not generic'],
  },
]

// ── Listening exercises ──────────────────────────────────────────────────────
const LISTENING_EXERCISES = [
  {
    id: 'summarise', title: 'Summarise Back', icon: '📋', level: 'Foundation',
    instruction: 'After any conversation today, try this: summarise what the other person said in your own words before giving your own opinion. In this exercise: listen to the passage below, then summarise it in 2-3 sentences.',
    passage: '"Last week I had a really frustrating day at work. My manager kept changing the brief for the report I\'d been working on for two weeks. By Friday I had three completely different versions and none of them were what they originally asked for. I don\'t know whether to speak to them directly or just keep rewriting."',
    task: 'Summarise the situation in 2-3 sentences. What happened? What\'s the core problem? What does the person need?',
    scienceTip: 'Paraphrasing (summarising in your own words) is the most trust-building listening technique. It signals "I was genuinely paying attention."',
  },
  {
    id: 'reflect_emotions', title: 'Reflect Emotions', icon: '🪞', level: 'Intermediate',
    instruction: 'Don\'t just summarise facts — name the emotion underneath what someone says.',
    passage: '"I gave the presentation to the whole team and I completely froze halfway through. I just stood there. People were looking at me and I couldn\'t find my next sentence. I wanted to disappear. I\'ve been avoiding speaking in meetings ever since."',
    task: 'Respond in 2 sentences: First, reflect the emotion you hear (not the events). Second, ask one open-ended question that invites them to say more.',
    scienceTip: 'Carl Rogers coined "active listening" in 1957. Naming emotions without judgment is the single most de-escalating communication skill.',
  },
  {
    id: 'open_questions', title: 'Open Questions', icon: '❓', level: 'Intermediate',
    instruction: 'Closed questions get yes/no. Open questions get stories. Practice turning closed questions into open ones.',
    passage: 'Someone says: "I\'m thinking of leaving my job."\n\nClosed question: "Is it because of your manager?"\nOpen question: "What\'s been making you think about that?"',
    task: 'Turn these closed questions into open ones:\n1. "Did you enjoy the project?"\n2. "Was the meeting productive?"\n3. "Are you feeling better?"',
    scienceTip: 'Open questions beginning with "what", "how", and "tell me about" consistently generate 3-4x more information than closed questions.',
  },
  {
    id: 'validate', title: 'Validate Without Agreeing', icon: '✋', level: 'Advanced',
    instruction: 'Validation means acknowledging someone\'s experience — not that you agree with them. This is a critical distinction.',
    passage: '"I think everyone in that meeting was against me. They kept interrupting me and rolling their eyes. I honestly don\'t think I should have to work with people who treat me that way."',
    task: 'Write a validating response that: 1) Acknowledges how they feel, 2) Doesn\'t agree or disagree with their interpretation, 3) Leaves space for them to say more.',
    scienceTip: 'Validation ("that sounds really frustrating") is different from agreement ("you\'re right, they\'re awful"). One builds trust. The other can reinforce distorted thinking.',
  },
]

// ── Body language science cards ──────────────────────────────────────────────
const PRESENCE_CARDS = [
  {
    id: 'gestures', title: 'Hand Gestures', icon: '🤲', score: 'High Impact',
    scienceFact: 'Vanessa Van Edwards found a strong correlation between the volume of hand gestures and high speaker ratings — even when watching TED Talks on mute. Gestures that visualise what you\'re saying (not scripted ones) are most effective.',
    exercise: 'Tell someone about your week. Make yourself use at least one deliberate hand gesture per sentence — pointing for specific things, spreading hands for "many", raising a hand for something important.',
    drill: 'Practice saying "There are THREE key things to know" — hold up three fingers as you say three. Then say "On one hand... on the other hand" — switch hands. This is "illustrative gesturing" and it\'s extremely memorable.',
    avoid: 'Self-touching (touching your face, neck, or arms while speaking) signals anxiety. Notice when you do it.',
  },
  {
    id: 'eye_contact', title: 'Eye Contact', icon: '👁️', score: 'Very High Impact',
    scienceFact: 'Research recommends 50% eye contact while speaking and 70% while listening. The key: look at ONE person per complete thought, then move naturally. Don\'t dart around. Don\'t stare.',
    exercise: 'In your next conversation: for each sentence you speak, look at one person for the full sentence. Then move to someone else for the next sentence. This makes a room of 50 feel like personal conversations.',
    drill: 'Practice reading this paragraph and looking up at an imaginary person after each sentence, holding the look for the full thought before moving on.',
    avoid: 'Don\'t break eye contact mid-sentence — it signals lack of conviction. Finish the thought, then move.',
  },
  {
    id: 'posture', title: 'Posture & Space', icon: '🧍', score: 'High Impact',
    scienceFact: 'Amy Cuddy\'s research found that "power postures" (taking up more space) affect cortisol and testosterone levels within 2 minutes. Closed postures (hunched, arms crossed) signal low confidence to both the audience AND your own nervous system.',
    exercise: 'Before any important conversation or presentation: stand with feet shoulder-width apart, shoulders back and down, chest open. Hold this for 2 minutes. Notice the physical difference in how you feel.',
    drill: 'While sitting: uncross your legs, place both feet on the floor, sit forward slightly, place hands loosely on the table. This "open seated posture" signals engagement and confidence.',
    avoid: 'Hunching, crossed arms, weight on one foot (it makes you look uncertain), fidgeting with objects.',
  },
  {
    id: 'facial', title: 'Facial Expression', icon: '😊', score: 'Medium-High Impact',
    scienceFact: 'Congruence — when your expression matches your message — is critical. Smiling while delivering bad news destroys credibility. Research shows audiences read micro-expressions in milliseconds.',
    exercise: 'Tell a story with a genuinely funny moment — let yourself actually smile. Then tell a serious moment — let your face be serious. Practice letting your face follow your genuine emotional response rather than fixing it in one expression.',
    drill: 'Say "I\'m so excited about this" with a completely neutral face. Notice how unconvincing it sounds. Now say it with genuine enthusiasm in your eyes and expression. That difference is congruence.',
    avoid: 'The "presentation smile" — a fixed, plastered-on grin that doesn\'t reach the eyes. It reads as fake immediately.',
  },
  {
    id: 'power_pose', title: 'Pre-Talk Power Ritual', icon: '⚡', score: 'Confidence Tool',
    scienceFact: 'Research shows that 2 minutes of expansive posture before a high-stakes interaction reduces cortisol (stress hormone) and increases testosterone (confidence hormone). It\'s used by Olympic athletes and top executives.',
    exercise: 'Try the 2-minute power ritual before your next presentation or difficult conversation:\n\n1. Stand tall, feet wide\n2. Put your hands on your hips (Wonder Woman pose)\n3. Hold for 2 minutes\n4. Take 3 deep belly breaths\n5. Shake out your hands\n6. Walk in.',
    drill: 'Alternatively: think of a moment you felt completely confident. Hold that memory and body posture for 30 seconds before speaking. Your nervous system responds to what your body does.',
    avoid: 'Doing this in public — it\'s a private backstage ritual. Also avoid doing it when genuinely underprepared — it can\'t replace substance.',
  },
]

// ── Impromptu topics ─────────────────────────────────────────────────────────
const IMPROMPTU_TOPICS = [
  { topic: 'What is one skill everyone should learn?', time: 60, difficulty: 'Easy' },
  { topic: 'Describe the best meal you have ever had.', time: 30, difficulty: 'Easy' },
  { topic: 'What does success mean to you?', time: 60, difficulty: 'Medium' },
  { topic: 'Convince me that failure is valuable.', time: 90, difficulty: 'Medium' },
  { topic: 'What would you do if you had no fear?', time: 60, difficulty: 'Medium' },
  { topic: 'Tell me about a time you changed your mind.', time: 90, difficulty: 'Medium' },
  { topic: 'What is the most important problem in the world right now?', time: 90, difficulty: 'Hard' },
  { topic: 'Describe yourself in three objects.', time: 60, difficulty: 'Hard' },
  { topic: 'Make a case for something you disagree with.', time: 90, difficulty: 'Hard' },
  { topic: 'What would you tell your 15-year-old self?', time: 60, difficulty: 'Easy' },
  { topic: 'Why does kindness matter?', time: 60, difficulty: 'Easy' },
  { topic: 'Defend a decision that most people think was wrong.', time: 90, difficulty: 'Hard' },
]

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'so', 'basically', 'literally', 'right', 'kind of', 'sort of', 'actually', 'honestly', 'i mean']

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function VoiceLab() {
  const [activeTab, setActiveTab]         = useState('warmup')
  const [view, setView]                   = useState('hub') // hub | active | done
  const [activeItem, setActiveItem]       = useState(null)

  // Warm-up state
  const [warmupStep, setWarmupStep]       = useState(0)
  const [warmupTimer, setWarmupTimer]     = useState(0)
  const [warmupRunning, setWarmupRunning] = useState(false)
  const [warmupDone, setWarmupDone]       = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])

  // Recording state
  const [recording, setRecording]         = useState(false)
  const [transcript, setTranscript]       = useState('')
  const [analysis, setAnalysis]           = useState(null)
  const [loading, setLoading]             = useState(false)
  const [waveform, setWaveform]           = useState(Array(24).fill(3))
  const [micError, setMicError]           = useState(false)

  // Filler state
  const [fillerCount, setFillerCount]     = useState({})
  const [totalWords, setTotalWords]       = useState(0)
  const [fillerLive, setFillerLive]       = useState([])
  const [fillerHistory, setFillerHistory] = useState([])

  // Impromptu state
  const [impTopic, setImpTopic]           = useState(null)
  const [impTimer, setImpTimer]           = useState(0)
  const [impRunning, setImpRunning]       = useState(false)
  const [prepTimer, setPrepTimer]         = useState(30)
  const [prepRunning, setPrepRunning]     = useState(false)

  // Presence card state
  const [presenceIdx, setPresenceIdx]     = useState(0)

  // Listening state
  const [listeningAnswer, setListeningAnswer] = useState('')

  // Pause Trainer state
  const [pausePrompt, setPausePrompt]     = useState(null)
  const [pauseTimer, setPauseTimer]       = useState(0)
  const [pauseRunning, setPauseRunning]   = useState(false)
  const [pauseAnalysis, setPauseAnalysis] = useState(null)
  const [pauseCount, setPauseCount]       = useState(0)
  const pauseRef = useRef(null)

  // Presentation Lab state
  const [presLabDrill, setPresLabDrill]   = useState(null)
  const [presLabHookType, setPresLabHookType] = useState('')
  const [presLabAnalysis, setPresLabAnalysis] = useState(null)

  const mediaRef  = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const animRef   = useRef(null)
  const recRef    = useRef(null)
  const timerRef  = useRef(null)
  const prepRef   = useRef(null)
  const warmRef   = useRef(null)

  const navigate  = useNavigate()
  const { profile, refreshProfile } = useApp()
  const { fluxSay, fluxSpeaking }   = useFluxVoice()
  const ag = profile?.ageGroup || 'explorer'

  // ── Mic setup ────────────────────────────────────────────────────────────
  const startMic = useCallback(async (onTranscript) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 64
      audioCtxRef.current.createMediaStreamSource(stream).connect(analyserRef.current)
      mediaRef.current = stream

      const draw = () => {
        const d = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(d)
        setWaveform(Array.from({ length: 24 }, (_, i) => Math.max(3, (d[Math.floor(i * d.length / 24)] || 0) / 255 * 50)))
        animRef.current = requestAnimationFrame(draw)
      }
      draw()

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recRef.current = new SR()
        recRef.current.continuous = true
        recRef.current.interimResults = true
        recRef.current.onresult = e => {
          const t = Array.from(e.results).map(r => r[0].transcript).join(' ')
          setTranscript(t)
          onTranscript?.(t)
        }
        recRef.current.start()
      }
      setMicError(false)
    } catch { setMicError(true) }
  }, [])

  const stopMic = useCallback(() => {
    cancelAnimationFrame(animRef.current)
    mediaRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    recRef.current?.stop()
    setWaveform(Array(24).fill(3))
  }, [])

  useEffect(() => () => {
    stopMic()
    clearInterval(timerRef.current)
    clearInterval(prepRef.current)
    clearInterval(warmRef.current)
  }, [stopMic])

  // ── Filler detection ─────────────────────────────────────────────────────
  const detectFillers = useCallback((text) => {
    const words = text.toLowerCase().split(/\s+/)
    setTotalWords(words.length)
    const counts = {}
    const detected = []
    FILLER_WORDS.forEach(f => {
      const regex = new RegExp(`\\b${f}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        counts[f] = matches.length
        detected.push(...Array(matches.length).fill(f))
      }
    })
    setFillerCount(counts)
    setFillerLive(detected.slice(-5))
  }, [])

  // ── Warm-up timer ────────────────────────────────────────────────────────
  const startWarmupStep = (idx) => {
    setWarmupStep(idx)
    setWarmupTimer(WARMUP_STEPS[idx].duration)
    setWarmupRunning(true)
    clearInterval(warmRef.current)
    warmRef.current = setInterval(() => {
      setWarmupTimer(t => {
        if (t <= 1) {
          clearInterval(warmRef.current)
          setWarmupRunning(false)
          setCompletedSteps(prev => [...new Set([...prev, idx])])
          return 0
        }
        return t - 1
      })
    }, 1000)
    fluxSay(WARMUP_STEPS[idx].instruction.split('\n')[0], true)
  }

  const nextWarmupStep = () => {
    const next = warmupStep + 1
    if (next >= WARMUP_STEPS.length) {
      setWarmupDone(true)
      setView('done')
      finishWarmup()
    } else {
      startWarmupStep(next)
    }
  }

  const finishWarmup = async () => {
    await addSession('voicelab_warmup', 85, { steps: WARMUP_STEPS.length })
    await markTodayStreak()
    await refreshProfile()
    fluxSay('Amazing warm-up! Your voice is ready to shine.', true)
  }

  // ── Impromptu timer ──────────────────────────────────────────────────────
  const startPrepTimer = () => {
    setPrepTimer(30)
    setPrepRunning(true)
    clearInterval(prepRef.current)
    prepRef.current = setInterval(() => {
      setPrepTimer(t => {
        if (t <= 1) { clearInterval(prepRef.current); setPrepRunning(false); return 0 }
        return t - 1
      })
    }, 1000)
  }

  const startImpTimer = () => {
    setImpTimer(impTopic?.time || 60)
    setImpRunning(true)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setImpTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          setImpRunning(false)
          stopMic()
          return 0
        }
        return t - 1
      })
    }, 1000)
    startMic()
  }

  // ── Generic finish exercise ──────────────────────────────────────────────
  const finishExercise = async (type, extraData = {}) => {
    stopMic()
    setRecording(false)
    setLoading(true)
    try {
      let result
      if (type === 'filler') {
        const total = Object.values(fillerCount).reduce((a, b) => a + b, 0)
        const rate = totalWords > 0 ? Math.round((total / totalWords) * 100) : 0
        result = await analyzeFillerWords(transcript, fillerCount, totalWords, profile)
        const entry = { date: new Date().toISOString(), fillers: total, words: totalWords, rate, score: result.score }
        const hist = await getSetting('filler_history', [])
        await setSetting('filler_history', [...(Array.isArray(hist) ? hist : []), entry].slice(-30))
        setFillerHistory(prev => [...prev, entry])
      } else if (type === 'story') {
        result = await analyzeStorytelling(activeItem?.id, transcript, profile)
      } else if (type === 'listening') {
        result = await analyzeActiveListening(activeItem?.id, listeningAnswer, profile)
      } else if (type === 'impromptu') {
        result = await analyzeCommSkill('impromptu', transcript, profile)
      } else {
        result = await analyzeCommSkill(type, transcript, profile)
      }
      setAnalysis(result)
      await addSession('voicelab_' + type, result.score || 70, { type, ...extraData, score: result.score })
      await markTodayStreak()
      await updateMemoryAfterSession('voicelab_' + type, { score: result.score, type }, profile)
      await refreshProfile()
      fluxSay(result.praise || getOfflineResponse('encouragement'), true)
    } catch {
      setAnalysis({
        score: 70,
        strengths: ['You completed the exercise — that takes courage'],
        improvements: ['Keep practicing this skill daily'],
        tip: 'Consistent small practice beats occasional big effort.',
        praise: getOfflineResponse('encouragement'),
      })
    }
    setLoading(false)
    setView('done')
  }

  // ── Load filler history ──────────────────────────────────────────────────
  useEffect(() => {
    getSetting('filler_history', []).then(h => setFillerHistory(Array.isArray(h) ? h : []))
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const ScoreRing = ({ score }) => {
    const color = score >= 80 ? 'var(--jade)' : score >= 60 ? 'var(--amber)' : 'var(--rose)'
    return (
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={`${score}, 100`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-bold text-xl" style={{ color }}>{score}</span>
        </div>
      </div>
    )
  }

  const Waveform = ({ active }) => (
    <div className="flex items-end justify-center gap-0.5 h-10">
      {waveform.map((h, i) => (
        <div key={i} className="wave-bar w-1.5"
          style={{ height: `${active ? h : 3}px`, opacity: active ? 1 : 0.3 }} />
      ))}
    </div>
  )

  const diffColor = { Easy: 'var(--jade)', Medium: 'var(--amber)', Hard: 'var(--rose)' }

  // ── Views ─────────────────────────────────────────────────────────────────

  // Hub
  if (view === 'hub') return (
    <div className="min-h-full pb-28 page-enter">
      <div className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
        <div>
          <h1 className="font-display text-xl font-bold text-white">Voice Lab</h1>
          <p className="text-white/35 text-xs">6 communication skill modules</p>
        </div>
        <span className="ml-auto text-2xl">🎙️</span>
      </div>

      {/* Flux message */}
      <div className="px-5 mb-5">
        <div className="flex flex-col items-center">
          <Flux size={80} ageGroup={ag} mood="happy" floating showMessage
            message="Your voice is an instrument. Every great communicator practises these foundations daily." />
        </div>
      </div>

      {/* Tab strip */}
      <div className="px-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all text-sm font-display font-semibold ${activeTab === t.id
              ? `bg-gradient-to-r ${t.color} ${t.border} text-white`
              : 'glass text-white/40 border-white/10'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Vocal Warm-Up ── */}
      {activeTab === 'warmup' && (
        <div className="px-5 space-y-3">
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--aqua)' }}>5-Minute Daily Ritual</div>
            <p className="text-white/70 text-sm">Used by professional speakers, singers, and broadcasters before every performance. Complete all 6 steps in sequence.</p>
          </div>
          {WARMUP_STEPS.map((step, i) => (
            <button key={step.id} onClick={() => { setActiveItem(step); setWarmupStep(i); setView('warmup_step') }}
              className="w-full card text-left active:scale-[0.98] transition-all flex items-center gap-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${completedSteps.includes(i) ? 'bg-jade/20' : 'glass-2'}`}
                style={completedSteps.includes(i) ? { border: '1px solid rgba(52,211,153,0.3)' } : {}}>
                {completedSteps.includes(i) ? '✓' : step.icon}
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold text-white text-sm">{step.label}</div>
                <div className="text-white/40 text-xs mt-0.5">{step.duration}s · {step.instruction.split('.')[0]}</div>
              </div>
              <div className="text-white/25">→</div>
            </button>
          ))}
          <button onClick={() => { setWarmupStep(0); startWarmupStep(0); setView('warmup_active') }}
            className="btn-aqua w-full py-4 font-display mt-2" style={{ color: '#05080f' }}>
            Start Full Warm-Up 🎵
          </button>
        </div>
      )}

      {/* ── Filler Detector ── */}
      {activeTab === 'filler' && (
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(251,113,133,0.2)', background: 'rgba(251,113,133,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--rose)' }}>The Science</div>
            <p className="text-white/70 text-sm">Fillers reduce credibility and impair comprehension. A silent pause sounds confident. A filler sounds unready. Filler rate: 0.12% – 8.8% across speakers.</p>
          </div>

          {fillerHistory.length > 0 && (
            <div className="card">
              <div className="section-label mb-2">Your Progress</div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {fillerHistory.slice(-7).map((h, i) => (
                  <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className="w-8 rounded-full" style={{
                      height: `${Math.max(8, (h.rate || 0) * 4)}px`,
                      background: h.rate < 3 ? 'var(--jade)' : h.rate < 6 ? 'var(--amber)' : 'var(--rose)',
                      minHeight: 8
                    }} />
                    <span className="text-white/30 text-[9px]">{h.rate}%</span>
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-1">Filler rate over last {fillerHistory.length} sessions</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="section-label">Practice Scenarios</p>
            {[
              { prompt: 'Tell me about yourself in 60 seconds.', time: 60 },
              { prompt: 'What is your greatest strength? Answer in 45 seconds.', time: 45 },
              { prompt: 'Explain what you do for a living to someone who has no idea what it is.', time: 60 },
              { prompt: 'Tell me about a challenge you overcame. 45 seconds.', time: 45 },
            ].map((s, i) => (
              <button key={i} onClick={() => {
                setActiveItem(s)
                setTranscript('')
                setFillerCount({})
                setTotalWords(0)
                setFillerLive([])
                setView('filler_active')
                setTimeout(() => startMic(detectFillers), 300)
              }}
                className="w-full card text-left flex items-start gap-3 active:scale-[0.98] transition-all">
                <span style={{ color: 'var(--rose)' }}>🚫</span>
                <div>
                  <p className="text-white text-sm font-display font-semibold">{s.prompt}</p>
                  <p className="text-white/40 text-xs mt-0.5">{s.time}s · aim for 0 fillers</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Story Studio ── */}
      {activeTab === 'story' && (
        <div className="px-5 space-y-3">
          <div className="card" style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--amber)' }}>Why Stories?</div>
            <p className="text-white/70 text-sm">Stanford research: stories are remembered 22× more than facts. Stories don't just entertain — they persuade, build trust, and make you unforgettable.</p>
          </div>
          {STORY_EXERCISES.map((ex, i) => (
            <button key={ex.id} onClick={() => {
              setActiveItem(ex)
              setTranscript('')
              setAnalysis(null)
              setView('story_active')
              setTimeout(() => startMic(), 300)
              fluxSay(ex.prompt, true)
            }}
              className="w-full card text-left active:scale-[0.98] transition-all flex items-start gap-4 animate-slide-up"
              style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="text-3xl">{ex.icon}</div>
              <div className="flex-1">
                <div className="font-display font-bold text-white text-sm">{ex.title}</div>
                <div className="text-white/40 text-xs mt-0.5">{ex.framework}</div>
                <span className="text-white/25 text-xs">{ex.time}</span>
              </div>
              <div className="text-white/25">→</div>
            </button>
          ))}
        </div>
      )}

      {/* ── Listening Lab ── */}
      {activeTab === 'listening' && (
        <div className="px-5 space-y-3">
          <div className="card" style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--jade)' }}>The Missing Half</div>
            <p className="text-white/70 text-sm">Active listening was coined by psychologist Carl Rogers in 1957. Research shows it promotes trust, reduces misunderstandings, and creates emotional connection faster than any other technique.</p>
          </div>
          {LISTENING_EXERCISES.map((ex, i) => (
            <button key={ex.id} onClick={() => {
              setActiveItem(ex)
              setListeningAnswer('')
              setAnalysis(null)
              setView('listening_active')
            }}
              className="w-full card text-left active:scale-[0.98] transition-all flex items-start gap-4 animate-slide-up"
              style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="text-3xl">{ex.icon}</div>
              <div className="flex-1">
                <div className="font-display font-bold text-white text-sm">{ex.title}</div>
                <div className="text-white/40 text-xs mt-0.5 line-clamp-2">{ex.instruction.split('.')[0]}</div>
              </div>
              <span className={`${i < 2 ? 'pill-jade' : i < 3 ? 'pill-amber' : 'pill-violet'} flex-shrink-0 text-[10px]`}>{ex.level}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Body Language ── */}
      {activeTab === 'presence' && (
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--violet)' }}>The 55-38-7 Rule</div>
            <p className="text-white/70 text-sm">Mehrabian's research: 55% of communication comes from body language, 38% from vocal quality, only 7% from words. Master the non-verbals.</p>
          </div>
          <div className="flex gap-2">
            {PRESENCE_CARDS.map((c, i) => (
              <button key={c.id}
                onClick={() => { setPresenceIdx(i); setView('presence_card') }}
                className={`flex-shrink-0 w-28 card text-center active:scale-[0.98] transition-all p-3 ${presenceIdx === i ? 'border-violet-500/40' : ''}`}
                style={presenceIdx === i ? { borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.1)' } : {}}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="font-display font-bold text-white text-xs leading-tight">{c.title}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setView('presence_card')}
            className="btn-violet w-full py-4 font-display">
            Open Science Cards 🧍
          </button>
        </div>
      )}

      {/* ── Impromptu ── */}
      {activeTab === 'impromptu' && (
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--amber)' }}>Why Impromptu?</div>
            <p className="text-white/70 text-sm">The best test of communication skill is what happens when you have no preparation. Impromptu speaking builds confidence, structure under pressure, and real-world readiness.</p>
          </div>
          <div className="space-y-2">
            {IMPROMPTU_TOPICS.map((t, i) => (
              <button key={i} onClick={() => {
                setImpTopic(t)
                setTranscript('')
                setAnalysis(null)
                setImpTimer(t.time)
                setView('impromptu_prep')
                startPrepTimer()
              }}
                className="w-full card text-left flex items-center gap-4 active:scale-[0.98] transition-all animate-slide-up"
                style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex-1">
                  <div className="font-display font-semibold text-white text-sm">{t.topic}</div>
                  <div className="text-white/40 text-xs mt-0.5">{t.time}s</div>
                </div>
                <span className="text-xs font-display font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: `${diffColor[t.difficulty]}22`, color: diffColor[t.difficulty], border: `1px solid ${diffColor[t.difficulty]}44` }}>
                  {t.difficulty}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PAUSE TRAINER tab ─────────────────────────────────────── */}
      {activeTab === 'pause' && (
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.04)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--aqua)' }}>Replace fillers with silence</div>
            <p className="text-white/70 text-sm leading-relaxed">Every "um", "uh", "like" you replace with a deliberate pause makes you sound more confident — instantly. This module trains that one habit.</p>
            <div className="mt-3 flex gap-3 flex-wrap">
              {['um','uh','like','you know','basically','sort of'].map(f => (
                <span key={f} className="text-xs px-2 py-1 rounded-lg font-mono" style={{ background: 'rgba(244,63,94,0.15)', color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.25)' }}>"{f}"</span>
              ))}
            </div>
          </div>
          <div className="section-label px-1">Choose a drill</div>
          <div className="space-y-2">
            {PAUSE_TRAINER_PROMPTS.map((p, i) => (
              <button key={p.id} onClick={() => { setPausePrompt(p); setView('pause_active'); setPauseAnalysis(null); setTranscript('') }}
                className="w-full card text-left flex items-center gap-4 active:scale-[0.98] transition-all animate-slide-up"
                style={{ animationDelay: `${i * 0.04}s` }}>
                <span className="text-2xl">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-white text-sm">{p.label}</div>
                  <div className="text-white/40 text-xs mt-0.5 truncate">{p.focus}</div>
                </div>
                <span className="text-xs text-white/30 flex-shrink-0">{p.duration}s</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PRESENTATION LAB tab ──────────────────────────────────── */}
      {activeTab === 'preslab' && (
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(217,70,239,0.2)', background: 'rgba(217,70,239,0.04)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--violet, #a78bfa)' }}>Two drills. Massive impact.</div>
            <p className="text-white/70 text-sm leading-relaxed">Most speakers lose audiences in the first 30 seconds. Most messages are foggy because they were never distilled. Fix both here.</p>
          </div>
          <div className="space-y-3">
            {PRESENTATION_LAB_DRILLS.map((d, i) => (
              <button key={d.id} onClick={() => { setPresLabDrill(d); setView('preslab_active'); setPresLabAnalysis(null); setTranscript('') }}
                className="w-full card text-left active:scale-[0.98] transition-all animate-slide-up"
                style={{ animationDelay: `${i * 0.06}s`, borderColor: 'rgba(217,70,239,0.18)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{d.icon}</span>
                  <div>
                    <div className="font-display font-bold text-white">{d.title}</div>
                    <div className="text-white/35 text-xs">{d.time}</div>
                  </div>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">{d.description}</p>
                <div className="mt-2 text-xs italic" style={{ color: 'rgba(217,70,239,0.7)' }}>💡 {d.scienceTip}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── Warm-up active ──────────────────────────────────────────────────────────
  if (view === 'warmup_active') {
    const step = WARMUP_STEPS[warmupStep]
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-6">
          <button onClick={() => { clearInterval(warmRef.current); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Vocal Warm-Up</h1>
            <p className="text-white/35 text-xs">Step {warmupStep + 1} of {WARMUP_STEPS.length}</p>
          </div>
        </div>
        <div className="px-5 space-y-4">
          {/* Progress */}
          <div className="flex gap-1.5">
            {WARMUP_STEPS.map((_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full transition-all"
                style={i < warmupStep ? { background: 'var(--jade)' } : i === warmupStep ? { background: 'var(--aqua)' } : { background: 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>

          <div className="flex justify-center py-2">
            <Flux size={80} ageGroup={ag} mood={warmupRunning ? 'excited' : 'happy'} floating speaking={warmupRunning} />
          </div>

          {/* Timer ring */}
          <div className="flex justify-center">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--aqua)" strokeWidth="2.5"
                  strokeDasharray={`${(warmupTimer / step.duration) * 100}, 100`}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-bold text-2xl text-white">{warmupTimer}s</span>
              </div>
            </div>
          </div>

          {/* Step card */}
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.25)', background: 'rgba(34,211,238,0.05)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{step.icon}</span>
              <span className="font-display font-bold text-white">{step.label}</span>
            </div>
            <p className="text-white/75 text-sm leading-relaxed whitespace-pre-line">{step.instruction}</p>
          </div>

          {/* Science tip */}
          <div className="card" style={{ borderColor: 'rgba(251,191,36,0.15)' }}>
            <div className="flex gap-2 items-start">
              <span style={{ color: 'var(--amber)' }}>💡</span>
              <p className="text-white/60 text-sm">{step.tip}</p>
            </div>
          </div>

          <div className="flex gap-3">
            {!warmupRunning && warmupTimer === 0 ? (
              <button onClick={nextWarmupStep} className="btn-jade w-full py-4 font-display" style={{ color: '#05080f' }}>
                {warmupStep + 1 < WARMUP_STEPS.length ? `Next: ${WARMUP_STEPS[warmupStep + 1].label} →` : 'Finish Warm-Up ✓'}
              </button>
            ) : !warmupRunning ? (
              <button onClick={() => startWarmupStep(warmupStep)} className="btn-aqua flex-1 py-4 font-display" style={{ color: '#05080f' }}>
                Start Timer ▶
              </button>
            ) : (
              <button onClick={() => { clearInterval(warmRef.current); setWarmupRunning(false) }}
                className="btn-ghost flex-1 py-4">Pause</button>
            )}
            {warmupRunning && (
              <button onClick={nextWarmupStep} className="btn-jade px-6 font-display" style={{ color: '#05080f' }}>
                Done ✓
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Individual warm-up step view (from hub list) ──────────────────────────
  if (view === 'warmup_step' && activeItem) {
    const step = activeItem
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-6">
          <button onClick={() => setView('hub')}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <h1 className="font-display text-xl font-bold text-white">{step.label}</h1>
        </div>
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.25)', background: 'rgba(34,211,238,0.05)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{step.icon}</span>
              <span className="text-white/40 text-xs">{step.duration}s</span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{step.instruction}</p>
          </div>
          <div className="card"><div className="flex gap-2"><span style={{ color: 'var(--amber)' }}>💡</span><p className="text-white/60 text-sm">{step.tip}</p></div></div>
          <button onClick={() => { startWarmupStep(WARMUP_STEPS.findIndex(s => s.id === step.id)); setView('warmup_active') }}
            className="btn-aqua w-full py-4 font-display" style={{ color: '#05080f' }}>
            Start This Step ▶
          </button>
        </div>
      </div>
    )
  }

  // ── Filler active ──────────────────────────────────────────────────────────
  if (view === 'filler_active') {
    const totalFillers = Object.values(fillerCount).reduce((a, b) => a + b, 0)
    const fillerRate = totalWords > 0 ? ((totalFillers / totalWords) * 100).toFixed(1) : '0.0'
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { stopMic(); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <h1 className="font-display text-xl font-bold text-white">Filler Detector</h1>
        </div>
        <div className="px-5 space-y-4">
          <div className="flex justify-center">
            <Flux size={80} ageGroup={ag} mood={recording ? 'excited' : 'happy'} floating speaking={recording} />
          </div>

          {/* Prompt */}
          <div className="card" style={{ borderColor: 'rgba(251,113,133,0.2)', background: 'rgba(251,113,133,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--rose)' }}>Your prompt</div>
            <p className="text-white font-display font-semibold">{activeItem?.prompt}</p>
            <p className="text-white/40 text-xs mt-1">Aim for ZERO filler words. Replace fillers with confident silence.</p>
          </div>

          {/* Live filler score */}
          <div className="grid grid-cols-3 gap-2">
            <div className="card text-center">
              <div className="font-display font-bold text-2xl" style={{ color: totalFillers === 0 ? 'var(--jade)' : 'var(--rose)' }}>{totalFillers}</div>
              <div className="text-white/40 text-xs">Fillers</div>
            </div>
            <div className="card text-center">
              <div className="font-display font-bold text-2xl text-white">{totalWords}</div>
              <div className="text-white/40 text-xs">Words</div>
            </div>
            <div className="card text-center">
              <div className="font-display font-bold text-2xl"
                style={{ color: parseFloat(fillerRate) < 3 ? 'var(--jade)' : parseFloat(fillerRate) < 6 ? 'var(--amber)' : 'var(--rose)' }}>
                {fillerRate}%
              </div>
              <div className="text-white/40 text-xs">Rate</div>
            </div>
          </div>

          {/* Live detected fillers */}
          {fillerLive.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {fillerLive.map((f, i) => (
                <span key={i} className="pill-rose text-xs animate-slide-up">{f}</span>
              ))}
            </div>
          )}

          {/* Detected breakdown */}
          {Object.keys(fillerCount).length > 0 && (
            <div className="card">
              <div className="section-label mb-2">Detected fillers</div>
              {Object.entries(fillerCount).sort((a, b) => b[1] - a[1]).map(([word, count]) => (
                <div key={word} className="flex justify-between items-center mb-1.5">
                  <span className="text-white/60 text-sm font-display">"{word}"</span>
                  <span className="text-white/80 text-sm font-bold" style={{ color: 'var(--rose)' }}>×{count}</span>
                </div>
              ))}
            </div>
          )}

          <Waveform active={recording} />
          {micError && <p className="text-center text-xs" style={{ color: 'var(--rose)' }}>Mic unavailable — speak and tap Done when finished</p>}

          <div className="flex gap-3">
            <button onPointerDown={() => setRecording(true)} onPointerUp={() => setRecording(false)} onPointerLeave={() => setRecording(false)}
              className="flex-1 py-4 rounded-2xl font-display font-bold transition-all active:scale-95"
              style={recording
                ? { background: 'rgba(239,68,68,0.8)', color: 'white', boxShadow: '0 4px 20px rgba(239,68,68,0.3)' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {recording ? '⏺ Speaking…' : '🎙️ Hold & Speak'}
            </button>
            <button onClick={() => finishExercise('filler')}
              className="btn-jade px-6 font-display text-sm" style={{ color: '#05080f' }}>Done ✓</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Story active ───────────────────────────────────────────────────────────
  if (view === 'story_active' && activeItem) {
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { stopMic(); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">{activeItem.title}</h1>
            <p className="text-white/35 text-xs">Story Studio · {activeItem.time}</p>
          </div>
        </div>
        <div className="px-5 space-y-4">
          <div className="flex justify-center">
            <Flux size={80} ageGroup={ag} mood={recording ? 'excited' : 'happy'} floating speaking={recording} />
          </div>

          {/* Framework */}
          <div className="card" style={{ borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--amber)' }}>Framework</div>
            <p className="text-white/90 font-display font-semibold text-sm">{activeItem.framework}</p>
          </div>

          {/* Prompt */}
          <div className="card">
            <div className="section-label mb-1">Your Prompt</div>
            <p className="text-white/80 text-sm leading-relaxed">{activeItem.prompt}</p>
          </div>

          {/* Criteria */}
          <div className="card">
            <div className="section-label mb-2">What Flux looks for</div>
            {activeItem.criteria.map((c, i) => (
              <div key={i} className="flex gap-2 mb-1 items-start">
                <span style={{ color: 'var(--aqua)' }} className="flex-shrink-0">→</span>
                <p className="text-white/60 text-sm">{c}</p>
              </div>
            ))}
          </div>

          {/* Science tip */}
          <div className="flex gap-2 items-start px-1">
            <span style={{ color: 'var(--violet)' }} className="flex-shrink-0">🧠</span>
            <p className="text-white/40 text-xs">{activeItem.scienceTip}</p>
          </div>

          {transcript && (
            <div className="card glass-2 text-white/50 text-sm">
              <div className="section-label mb-1">What Flux heard</div>
              {transcript}
            </div>
          )}

          <Waveform active={recording} />

          <div className="flex gap-3">
            <button onPointerDown={() => setRecording(true)} onPointerUp={() => setRecording(false)} onPointerLeave={() => setRecording(false)}
              className="flex-1 py-4 rounded-2xl font-display font-bold transition-all active:scale-95"
              style={recording
                ? { background: 'rgba(239,68,68,0.8)', color: 'white', boxShadow: '0 4px 20px rgba(239,68,68,0.3)' }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {recording ? '⏺ Speaking…' : '🎙️ Hold & Speak'}
            </button>
            <button onClick={() => finishExercise('story', { exercise: activeItem.id })}
              className="btn-amber px-6 font-display text-sm" style={{ color: '#05080f' }}>Analyse ✓</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Listening active ───────────────────────────────────────────────────────
  if (view === 'listening_active' && activeItem) {
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => setView('hub')}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">{activeItem.title}</h1>
            <p className="text-white/35 text-xs">Listening Lab · {activeItem.level}</p>
          </div>
        </div>
        <div className="px-5 space-y-4">
          <div className="flex justify-center">
            <Flux size={70} ageGroup={ag} mood="happy" floating />
          </div>

          {/* Instruction */}
          <div className="card" style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.05)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--jade)' }}>The Skill</div>
            <p className="text-white/80 text-sm leading-relaxed">{activeItem.instruction}</p>
          </div>

          {/* Passage to listen to */}
          <div className="card" style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="section-label">Read this passage</div>
              {ttsAvailable() && (
                <button onClick={() => speak(activeItem.passage, { ageGroup: ag, rate: 0.85 })}
                  className="text-white/30 text-xs hover:text-white/60 flex items-center gap-1">
                  🔊 Hear it
                </button>
              )}
            </div>
            <p className="text-white/75 text-sm leading-relaxed italic">{activeItem.passage}</p>
          </div>

          {/* Task */}
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--aqua)' }}>Your Task</div>
            <p className="text-white/80 text-sm">{activeItem.task}</p>
          </div>

          {/* Answer text area */}
          <div>
            <div className="section-label mb-2">Your Response</div>
            <textarea
              value={listeningAnswer}
              onChange={e => setListeningAnswer(e.target.value)}
              placeholder="Type your response here..."
              rows={5}
              className="input-field resize-none"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>

          {/* Science tip */}
          <div className="flex gap-2 items-start px-1">
            <span style={{ color: 'var(--violet)' }}>🧠</span>
            <p className="text-white/40 text-xs">{activeItem.scienceTip}</p>
          </div>

          <button onClick={() => finishExercise('listening', { exercise: activeItem.id })}
            disabled={!listeningAnswer.trim() || loading}
            className="btn-jade w-full py-4 font-display disabled:opacity-40" style={{ color: '#05080f' }}>
            {loading ? '🧠 Analysing…' : 'Get Feedback ✓'}
          </button>
        </div>
      </div>
    )
  }

  // ── Presence cards ─────────────────────────────────────────────────────────
  if (view === 'presence_card') {
    const card = PRESENCE_CARDS[presenceIdx]
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => setView('hub')}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Body Language</h1>
            <p className="text-white/35 text-xs">{presenceIdx + 1} of {PRESENCE_CARDS.length}</p>
          </div>
        </div>
        <div className="px-5 space-y-4">
          {/* Tab strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PRESENCE_CARDS.map((c, i) => (
              <button key={c.id} onClick={() => setPresenceIdx(i)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display transition-all ${presenceIdx === i
                  ? 'bg-violet-500/20 text-white border border-violet-500/40'
                  : 'glass text-white/40'}`}
                style={presenceIdx === i ? { color: 'var(--violet)' } : {}}>
                {c.icon} {c.title}
              </button>
            ))}
          </div>

          {/* Science fact */}
          <div className="card" style={{ borderColor: 'rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.05)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">{card.icon}</span>
              <div>
                <div className="font-display font-bold text-white">{card.title}</div>
                <span className="pill-violet text-[10px]">{card.score}</span>
              </div>
            </div>
            <div className="section-label mb-1" style={{ color: 'var(--violet)' }}>The Research</div>
            <p className="text-white/75 text-sm leading-relaxed">{card.scienceFact}</p>
          </div>

          {/* Exercise */}
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--aqua)' }}>Today's Exercise</div>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">{card.exercise}</p>
          </div>

          {/* Drill */}
          <div className="card">
            <div className="section-label mb-1">Practice Drill</div>
            <p className="text-white/65 text-sm leading-relaxed">{card.drill}</p>
          </div>

          {/* Avoid */}
          <div className="card" style={{ borderColor: 'rgba(251,113,133,0.15)' }}>
            <div className="section-label mb-1" style={{ color: 'var(--rose)' }}>What to avoid</div>
            <p className="text-white/60 text-sm">{card.avoid}</p>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {presenceIdx > 0 && (
              <button onClick={() => setPresenceIdx(i => i - 1)} className="btn-ghost flex-1">← Prev</button>
            )}
            {presenceIdx < PRESENCE_CARDS.length - 1 ? (
              <button onClick={() => setPresenceIdx(i => i + 1)} className="btn-violet flex-1 font-display">Next →</button>
            ) : (
              <button onClick={async () => {
                await addSession('voicelab_presence', 85, { cardsRead: PRESENCE_CARDS.length })
                await markTodayStreak()
                await refreshProfile()
                setView('hub')
              }} className="btn-jade flex-1 font-display" style={{ color: '#05080f' }}>Complete ✓</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Impromptu prep ─────────────────────────────────────────────────────────
  if (view === 'impromptu_prep' && impTopic) {
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { clearInterval(prepRef.current); setPrepRunning(false); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <h1 className="font-display text-xl font-bold text-white">Impromptu Speaking</h1>
        </div>
        <div className="px-5 space-y-5">
          <div className="flex justify-center">
            <Flux size={80} ageGroup={ag} mood="happy" floating />
          </div>

          {/* Topic */}
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))', borderColor: 'rgba(251,191,36,0.3)' }}>
            <div className="section-label mb-2" style={{ color: 'var(--amber)' }}>Your Topic</div>
            <p className="font-display font-bold text-white text-xl leading-snug">"{impTopic.topic}"</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-white/40 text-sm">Target: {impTopic.time}s</span>
              <span className="text-xs font-display font-bold px-2 py-0.5 rounded-lg"
                style={{ background: `${diffColor[impTopic.difficulty]}22`, color: diffColor[impTopic.difficulty], border: `1px solid ${diffColor[impTopic.difficulty]}44` }}>
                {impTopic.difficulty}
              </span>
            </div>
          </div>

          {/* Prep timer */}
          <div className="card text-center">
            <div className="section-label mb-2">Preparation Time</div>
            <div className="font-display font-bold text-4xl text-white">{prepTimer}s</div>
            <p className="text-white/40 text-xs mt-1">Think. Sketch 3 points. Find your opening line.</p>
          </div>

          {/* Structure guide */}
          <div className="card">
            <div className="section-label mb-2">Quick Structure</div>
            {['Opening: Bold statement or question', 'Point 1: Your strongest idea', 'Point 2: A supporting example', 'Close: Echo your opening'].map((p, i) => (
              <div key={i} className="flex gap-2 mb-1.5 items-start">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(34,211,238,0.15)', color: 'var(--aqua)' }}>{i + 1}</div>
                <p className="text-white/65 text-sm">{p}</p>
              </div>
            ))}
          </div>

          <button onClick={() => {
            clearInterval(prepRef.current)
            setPrepRunning(false)
            setView('impromptu_active')
            setTimeout(() => { startImpTimer(); fluxSay('You have ' + impTopic.time + ' seconds. Go!', true) }, 300)
          }}
            className="btn-amber w-full py-4 font-display" style={{ color: '#05080f' }}>
            {prepTimer > 0 ? `I'm Ready — Start ⚡` : 'Start Speaking ⚡'}
          </button>
        </div>
      </div>
    )
  }

  // ── Impromptu active ───────────────────────────────────────────────────────
  if (view === 'impromptu_active' && impTopic) {
    const pct = (impTimer / impTopic.time) * 100
    const timerColor = pct > 50 ? 'var(--jade)' : pct > 20 ? 'var(--amber)' : 'var(--rose)'
    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { stopMic(); clearInterval(timerRef.current); setImpRunning(false); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <h1 className="font-display text-xl font-bold text-white">Speaking Now</h1>
        </div>
        <div className="px-5 space-y-4">
          <div className="flex justify-center">
            <Flux size={80} ageGroup={ag} mood="excited" floating speaking={impRunning} />
          </div>

          {/* Countdown */}
          <div className="flex justify-center">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={timerColor} strokeWidth="2.5"
                  strokeDasharray={`${pct}, 100`} strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-bold text-3xl text-white">{impTimer}</span>
                <span className="text-white/40 text-xs">sec</span>
              </div>
            </div>
          </div>

          {/* Topic reminder */}
          <div className="card text-center" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
            <p className="text-white/60 text-xs mb-1">Topic</p>
            <p className="font-display font-semibold text-white">{impTopic.topic}</p>
          </div>

          {transcript && (
            <div className="card text-white/50 text-sm">
              <div className="section-label mb-1">Live transcript</div>
              {transcript}
            </div>
          )}

          <Waveform active={impRunning} />

          {!impRunning && impTimer === 0 ? (
            <button onClick={() => finishExercise('impromptu', { topic: impTopic.topic })}
              className="btn-jade w-full py-4 font-display" style={{ color: '#05080f' }}>
              Get Feedback ✓
            </button>
          ) : (
            <button onClick={() => { stopMic(); clearInterval(timerRef.current); setImpRunning(false); finishExercise('impromptu', { topic: impTopic.topic }) }}
              className="btn-amber w-full py-4 font-display" style={{ color: '#05080f' }}>
              Finish Early & Get Feedback
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Done / Analysis ────────────────────────────────────────────────────────
  if (view === 'done') {
    if (loading) return (
      <div className="min-h-full flex flex-col items-center justify-center gap-5 pb-28">
        <Flux size={90} ageGroup={ag} mood="excited" floating />
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(34,211,238,0.2)', borderTopColor: 'var(--aqua)' }} />
        <p className="text-white/40 text-sm font-display">Analysing your speech…</p>
      </div>
    )

    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { setView('hub'); setAnalysis(null); setTranscript('') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <h1 className="font-display text-xl font-bold text-white">Feedback</h1>
        </div>
        <div className="px-5 space-y-5">
          <div className="flex flex-col items-center gap-3">
            <Flux size={90} ageGroup={ag} mood="excited" floating />
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-white">Analysis Complete</h2>
            </div>
          </div>

          {analysis && (
            <>
              <div className="flex justify-center">
                <ScoreRing score={analysis.score || 70} />
              </div>

              {/* Warm-up special case */}
              {warmupDone && (
                <div className="card text-center" style={{ borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)' }}>
                  <div className="text-3xl mb-2">🎵</div>
                  <p className="font-display font-bold text-white">Full Warm-Up Complete!</p>
                  <p className="text-white/50 text-sm mt-1">All 6 steps done. Your voice is ready.</p>
                </div>
              )}

              <div className="card" style={{ borderColor: 'rgba(52,211,153,0.2)' }}>
                <div className="section-label mb-2" style={{ color: 'var(--jade)' }}>What you did well</div>
                {(analysis.strengths || []).map((s, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 items-start">
                    <span style={{ color: 'var(--jade)' }}>✓</span>
                    <p className="text-white/75 text-sm">{s}</p>
                  </div>
                ))}
              </div>

              <div className="card" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
                <div className="section-label mb-2" style={{ color: 'var(--amber)' }}>Focus area</div>
                {(analysis.improvements || []).map((s, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 items-start">
                    <span style={{ color: 'var(--amber)' }}>→</span>
                    <p className="text-white/75 text-sm">{s}</p>
                  </div>
                ))}
                {analysis.tip && <p className="text-white/45 text-xs mt-2 pt-2 border-t border-white/8 italic">💡 {analysis.tip}</p>}
              </div>

              {/* Filler detail */}
              {analysis.fillerBreakdown && (
                <div className="card" style={{ borderColor: 'rgba(251,113,133,0.2)' }}>
                  <div className="section-label mb-2" style={{ color: 'var(--rose)' }}>Filler breakdown</div>
                  {Object.entries(analysis.fillerBreakdown).map(([w, c]) => (
                    <div key={w} className="flex justify-between mb-1">
                      <span className="text-white/60 text-sm">"{w}"</span>
                      <span style={{ color: 'var(--rose)' }} className="text-sm font-bold">×{c}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 items-start card">
                <Flux size={36} ageGroup={ag} mood="happy" />
                <p className="text-white/80 text-sm leading-relaxed flex-1">{analysis.praise}</p>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setView('hub'); setAnalysis(null); setTranscript(''); setWarmupDone(false) }}
              className="btn-ghost flex-1">More Practice</button>
            <button onClick={() => navigate('/home')} className="btn-aqua flex-1 font-display" style={{ color: '#05080f' }}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  // ── PAUSE TRAINER active ──────────────────────────────────────────────────
  if (view === 'pause_active') {
    const p = pausePrompt
    if (!p) { setView('hub'); return null }
    const done = pauseRunning === false && pauseTimer === 0 && pauseAnalysis === null && transcript

    const startPauseDrill = () => {
      setTranscript(''); setPauseCount(0); setPauseAnalysis(null); setFillerCount({})
      setPauseTimer(p.duration); setPauseRunning(true)
      pauseRef.current = setInterval(() => {
        setPauseTimer(prev => {
          if (prev <= 1) { clearInterval(pauseRef.current); setPauseRunning(false); return 0 }
          return prev - 1
        })
      }, 1000)
      startMic((t) => {
        setTranscript(t)
        // Count fillers using the same FILLER_WORDS list
        const counts = {}
        FILLER_WORDS.forEach(f => {
          const regex = new RegExp(`\\b${f}\\b`, 'gi')
          const matches = t.match(regex)
          if (matches) counts[f] = matches.length
        })
        setFillerCount(counts)
        setTotalWords(t.split(/\s+/).length)
        // Rough pause count: punctuation signals deliberate pauses
        const pauses = (t.match(/[,\.…\-–]/g) || []).length
        setPauseCount(pauses)
      })
    }

    const submitPauseDrill = async () => {
      stopMic()
      clearInterval(pauseRef.current)
      setPauseRunning(false)
      if (!transcript.trim()) return
      setLoading(true)
      const wc = totalWords
      const fc = Object.values(fillerCount).reduce((a, b) => a + b, 0)
      const result = await analyzePauseTrainer(transcript, fc, pauseCount, wc, p.id, profile)
      setPauseAnalysis(result)
      setLoading(false)
    }

    if (pauseAnalysis) {
      return (
        <div className="min-h-full pb-28 page-enter">
          <div className="flex items-center gap-3 px-5 pt-8 pb-4">
            <button onClick={() => { setView('hub'); setPauseAnalysis(null); setTranscript('') }}
              className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
            <h1 className="font-display text-xl font-bold text-white">Pause Results</h1>
          </div>
          <div className="px-5 space-y-4">
            {/* Score ring */}
            <div className="flex flex-col items-center py-4">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--aqua)" strokeWidth="2.5"
                    strokeDasharray={`${pauseAnalysis.score}, 100`} strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display font-bold text-3xl text-white">{pauseAnalysis.score}</span>
                  <span className="text-white/35 text-xs">/ 100</span>
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-center">
                <div>
                  <div className="font-display font-bold text-lg" style={{ color: 'var(--rose)' }}>{pauseAnalysis.fillerRate}%</div>
                  <div className="text-white/35 text-xs">filler rate</div>
                </div>
                <div>
                  <div className="font-display font-bold text-lg" style={{ color: 'var(--jade)' }}>{pauseAnalysis.pausesUsed}</div>
                  <div className="text-white/35 text-xs">pauses used</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
              <div className="section-label mb-2" style={{ color: 'var(--jade)' }}>What worked</div>
              {(pauseAnalysis.strengths || []).map((s, i) => (
                <div key={i} className="flex gap-2 mb-1.5"><span style={{ color: 'var(--jade)' }}>✓</span><p className="text-white/75 text-sm">{s}</p></div>
              ))}
            </div>

            <div className="card" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
              <div className="section-label mb-2" style={{ color: 'var(--amber)' }}>Next focus</div>
              {(pauseAnalysis.improvements || []).map((s, i) => (
                <div key={i} className="flex gap-2 mb-1.5"><span style={{ color: 'var(--amber)' }}>→</span><p className="text-white/75 text-sm">{s}</p></div>
              ))}
              {pauseAnalysis.tip && <p className="text-white/45 text-xs mt-2 pt-2 border-t border-white/8 italic">💡 {pauseAnalysis.tip}</p>}
            </div>

            <div className="flex gap-3 items-start card">
              <Flux size={36} ageGroup={ag} mood="happy"/>
              <p className="text-white/80 text-sm leading-relaxed flex-1">{pauseAnalysis.praise}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setPauseAnalysis(null); setTranscript(''); setPauseRunning(false); setPauseTimer(0) }}
                className="btn-ghost flex-1">Try Again</button>
              <button onClick={() => { setView('hub'); setActiveTab('pause'); setPauseAnalysis(null) }}
                className="btn-aqua flex-1 font-display" style={{ color: '#05080f' }}>More Drills</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { stopMic(); clearInterval(pauseRef.current); setPauseRunning(false); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">⏸️ {p.label}</h1>
            <p className="text-white/35 text-xs">{p.duration}s drill</p>
          </div>
        </div>
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.04)' }}>
            <p className="text-white/80 text-sm leading-relaxed">{p.prompt}</p>
          </div>
          <div className="card" style={{ borderColor: 'rgba(251,191,36,0.15)' }}>
            <div className="flex gap-2"><span style={{ color: 'var(--amber)' }}>⏸️</span><p className="text-white/60 text-sm italic">{p.focus}</p></div>
          </div>

          {/* Timer + waveform */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--aqua)" strokeWidth="2.5"
                  strokeDasharray={`${p.duration > 0 ? (pauseTimer / p.duration) * 100 : 0}, 100`} strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-bold text-2xl text-white">{pauseTimer || p.duration}s</span>
              </div>
            </div>
            {pauseRunning && (
              <div className="flex items-end gap-0.5 h-8">
                {waveform.map((h, i) => (
                  <div key={i} className="w-1 rounded-full transition-all duration-75"
                    style={{ height: `${h}px`, background: 'var(--aqua)', opacity: 0.7 }}/>
                ))}
              </div>
            )}
            {pauseRunning && (
              <div className="flex gap-4 text-center">
                <div><div className="font-bold text-lg" style={{ color: 'var(--rose)' }}>{Object.values(fillerCount).reduce((a,b)=>a+b,0)}</div><div className="text-white/35 text-xs">fillers</div></div>
                <div><div className="font-bold text-lg" style={{ color: 'var(--jade)' }}>{pauseCount}</div><div className="text-white/35 text-xs">pauses</div></div>
              </div>
            )}
          </div>

          {!pauseRunning && pauseTimer === 0 && transcript ? (
            <button onClick={submitPauseDrill} disabled={loading}
              className="btn-aqua w-full font-display" style={{ color: '#05080f' }}>
              {loading ? 'Analysing…' : 'See Results →'}
            </button>
          ) : !pauseRunning ? (
            <button onClick={startPauseDrill} className="btn-aqua w-full font-display" style={{ color: '#05080f' }}>
              Start Drill
            </button>
          ) : (
            <button onClick={() => { stopMic(); clearInterval(pauseRef.current); setPauseRunning(false) }}
              className="btn-ghost w-full">Stop Early</button>
          )}
        </div>
      </div>
    )
  }

  // ── PRESENTATION LAB active ────────────────────────────────────────────────
  if (view === 'preslab_active') {
    const d = presLabDrill
    if (!d) { setView('hub'); return null }

    const submitPresLab = async () => {
      stopMic()
      if (!transcript.trim()) return
      setLoading(true)
      const result = await analyzePresentationDrill(d.id, transcript, presLabHookType, profile)
      setPresLabAnalysis(result)
      setLoading(false)
    }

    if (presLabAnalysis) {
      return (
        <div className="min-h-full pb-28 page-enter">
          <div className="flex items-center gap-3 px-5 pt-8 pb-4">
            <button onClick={() => { setView('hub'); setPresLabAnalysis(null); setTranscript('') }}
              className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
            <h1 className="font-display text-xl font-bold text-white">{d.title} — Results</h1>
          </div>
          <div className="px-5 space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#d946ef" strokeWidth="2.5"
                    strokeDasharray={`${presLabAnalysis.score}, 100`} strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display font-bold text-3xl text-white">{presLabAnalysis.score}</span>
                </div>
              </div>
              {presLabAnalysis.hookLanded !== undefined && (
                <div className="mt-3 px-3 py-1 rounded-full text-xs font-display font-semibold"
                  style={presLabAnalysis.hookLanded
                    ? { background: 'rgba(52,211,153,0.15)', color: 'var(--jade)', border: '1px solid rgba(52,211,153,0.3)' }
                    : { background: 'rgba(251,191,36,0.15)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)' }}>
                  {presLabAnalysis.hookLanded ? '✓ Hook landed' : '→ Preamble detected'}
                </div>
              )}
            </div>

            {presLabAnalysis.verdict && (
              <div className="card" style={{ borderColor: 'rgba(217,70,239,0.2)', background: 'rgba(217,70,239,0.05)' }}>
                <p className="text-white/80 text-sm leading-relaxed italic">"{presLabAnalysis.verdict}"</p>
              </div>
            )}

            <div className="card" style={{ borderColor: 'rgba(52,211,153,0.2)' }}>
              <div className="section-label mb-2" style={{ color: 'var(--jade)' }}>What landed</div>
              {(presLabAnalysis.strengths || []).map((s, i) => (
                <div key={i} className="flex gap-2 mb-1.5"><span style={{ color: 'var(--jade)' }}>✓</span><p className="text-white/75 text-sm">{s}</p></div>
              ))}
            </div>
            <div className="card" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
              <div className="section-label mb-2" style={{ color: 'var(--amber)' }}>Sharpen this</div>
              {(presLabAnalysis.improvements || []).map((s, i) => (
                <div key={i} className="flex gap-2 mb-1.5"><span style={{ color: 'var(--amber)' }}>→</span><p className="text-white/75 text-sm">{s}</p></div>
              ))}
              {presLabAnalysis.tip && <p className="text-white/45 text-xs mt-2 pt-2 border-t border-white/8 italic">💡 {presLabAnalysis.tip}</p>}
            </div>
            <div className="flex gap-3 items-start card">
              <Flux size={36} ageGroup={ag} mood="happy"/>
              <p className="text-white/80 text-sm leading-relaxed flex-1">{presLabAnalysis.praise}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPresLabAnalysis(null); setTranscript('') }} className="btn-ghost flex-1">Try Again</button>
              <button onClick={() => { setView('hub'); setActiveTab('preslab'); setPresLabAnalysis(null) }}
                className="btn-aqua flex-1 font-display" style={{ color: '#05080f' }}>More Drills</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-full pb-28 page-enter">
        <div className="flex items-center gap-3 px-5 pt-8 pb-4">
          <button onClick={() => { stopMic(); setView('hub') }}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-white">←</button>
          <div>
            <h1 className="font-display text-xl font-bold text-white">{d.icon} {d.title}</h1>
            <p className="text-white/35 text-xs">{d.time}</p>
          </div>
        </div>
        <div className="px-5 space-y-4">
          <div className="card" style={{ borderColor: 'rgba(217,70,239,0.2)', background: 'rgba(217,70,239,0.04)' }}>
            <p className="text-white/70 text-sm italic leading-relaxed">💡 {d.scienceTip}</p>
          </div>

          {/* Opening Lines: hook type selector + hook reference */}
          {d.id === 'opening_lines' && (
            <>
              <div>
                <div className="section-label px-1 mb-2">Choose your hook type</div>
                <div className="flex gap-2 flex-wrap">
                  {d.hookTypes.map(h => (
                    <button key={h.type} onClick={() => setPresLabHookType(h.type)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all font-display font-semibold ${presLabHookType === h.type ? 'text-white' : 'text-white/40 border-white/15'}`}
                      style={presLabHookType === h.type ? { background: 'rgba(217,70,239,0.25)', borderColor: 'rgba(217,70,239,0.5)', color: '#d946ef' } : {}}>
                      {h.type}
                    </button>
                  ))}
                </div>
              </div>
              {presLabHookType && (() => {
                const h = d.hookTypes.find(x => x.type === presLabHookType)
                return h ? (
                  <div className="card" style={{ borderColor: 'rgba(217,70,239,0.15)' }}>
                    <div className="text-white/45 text-xs mb-1">Example</div>
                    <p className="text-white/70 text-sm italic">"{h.example}"</p>
                    <p className="text-white/40 text-xs mt-1">Why it works: {h.why}</p>
                  </div>
                ) : null
              })()}
            </>
          )}

          {/* One-Message: step list */}
          {d.id === 'one_message' && (
            <div className="space-y-2">
              {d.steps.map(s => (
                <div key={s.step} className="card flex gap-3" style={{ borderColor: 'rgba(217,70,239,0.12)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-display font-bold"
                    style={{ background: 'rgba(217,70,239,0.2)', color: '#d946ef' }}>{s.step}</div>
                  <div>
                    <div className="font-display font-semibold text-white text-sm">{s.label}</div>
                    <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{s.instruction}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* The drill prompt */}
          <div className="card" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="section-label mb-1">Your task</div>
            <p className="text-white/80 text-sm leading-relaxed">{d.prompt}</p>
          </div>

          {/* Criteria */}
          <div className="card" style={{ borderColor: 'rgba(52,211,153,0.15)' }}>
            <div className="section-label mb-2" style={{ color: 'var(--jade)' }}>Success criteria</div>
            {d.criteria.map((c, i) => (
              <div key={i} className="flex gap-2 mb-1.5"><span style={{ color: 'var(--jade)' }}>✓</span><p className="text-white/65 text-xs">{c}</p></div>
            ))}
          </div>

          {/* Recording */}
          {transcript ? (
            <div className="card" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="section-label mb-1">Your transcript</div>
              <p className="text-white/70 text-sm leading-relaxed">{transcript}</p>
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              onPointerDown={() => { setRecording(true); startMic(t => setTranscript(t)) }}
              onPointerUp={() => { stopMic(); setRecording(false) }}
              onPointerLeave={() => { stopMic(); setRecording(false) }}
              className={`flex-1 py-4 rounded-2xl font-display font-bold text-sm transition-all active:scale-95 ${recording ? 'bg-red-500 text-white' : 'bg-white/10 text-white/70'}`}>
              {recording ? '⏺ Recording…' : '🎙️ Hold to Record'}
            </button>
            {transcript && !recording && (
              <button onClick={submitPresLab} disabled={loading}
                className="flex-1 btn-aqua font-display" style={{ color: '#05080f' }}>
                {loading ? 'Analysing…' : 'Analyse →'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
