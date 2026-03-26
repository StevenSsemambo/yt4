// ─── FLUX VOICE ENGINE ────────────────────────────────────────────────────────
// Text-to-Speech powered by Web Speech API (fully on-device, no network needed)
// Flux speaks with a warm, natural voice adapted per age group
// ─────────────────────────────────────────────────────────────────────────────

let currentUtterance = null
let voiceList = []
let voiceReady = false

// Load voices (they load async in browsers)
const loadVoices = () => {
  voiceList = window.speechSynthesis?.getVoices() || []
  voiceReady = voiceList.length > 0
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

// ─── VOICE SELECTION ──────────────────────────────────────────────────────────
const selectVoice = (ageGroup) => {
  if (!voiceList.length) loadVoices()

  // Priority voice names by age group
  const preferences = {
    little: ['Samantha', 'Karen', 'Moira', 'Tessa', 'Google US English Female', 'en-US-female', 'female'],
    explorer: ['Samantha', 'Karen', 'Google US English', 'en-US', 'Daniel'],
    navigator: ['Daniel', 'Alex', 'Google US English Male', 'en-GB', 'Oliver'],
    adult: ['Daniel', 'Alex', 'Google UK English Male', 'en-GB-male', 'Oliver'],
  }[ageGroup] || ['Samantha', 'Google US English', 'en-US']

  // Try to find a preferred voice
  for (const pref of preferences) {
    const match = voiceList.find(v =>
      v.name.toLowerCase().includes(pref.toLowerCase()) ||
      v.lang.toLowerCase().includes(pref.toLowerCase())
    )
    if (match) return match
  }

  // Fallback: any English voice
  return voiceList.find(v => v.lang.startsWith('en')) || voiceList[0] || null
}

// ─── VOICE SETTINGS BY AGE GROUP ─────────────────────────────────────────────
const voiceSettings = {
  little:    { rate: 0.85, pitch: 1.15, volume: 1.0 },
  explorer:  { rate: 0.90, pitch: 1.05, volume: 1.0 },
  navigator: { rate: 0.95, pitch: 0.95, volume: 1.0 },
  adult:     { rate: 1.00, pitch: 0.90, volume: 1.0 },
}

// ─── SPEAK ────────────────────────────────────────────────────────────────────
export const speak = (text, options = {}) => {
  if (!window.speechSynthesis || !text) return Promise.resolve()

  return new Promise((resolve, reject) => {
    // Stop anything currently speaking
    stopSpeaking()

    const {
      ageGroup = 'explorer',
      onStart,
      onEnd,
      onWord,
      interrupt = true
    } = options

    // Strip emoji and markdown from spoken text
    const cleanText = text
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/[*_`~#]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) return resolve()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    const settings = voiceSettings[ageGroup] || voiceSettings.explorer
    const voice = selectVoice(ageGroup)

    utterance.rate = options.rate ?? settings.rate
    utterance.pitch = options.pitch ?? settings.pitch
    utterance.volume = options.volume ?? settings.volume
    if (voice) utterance.voice = voice

    utterance.onstart = () => { onStart?.() }
    utterance.onend = () => { onEnd?.(); currentUtterance = null; resolve() }
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') { console.warn('TTS error:', e.error) }
      currentUtterance = null
      resolve()
    }
    if (onWord) utterance.onboundary = onWord

    currentUtterance = utterance

    // Chrome bug workaround: resume if paused
    if (window.speechSynthesis.paused) window.speechSynthesis.resume()
    window.speechSynthesis.speak(utterance)
  })
}

// ─── STOP ──────────────────────────────────────────────────────────────────────
export const stopSpeaking = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
    currentUtterance = null
  }
}

// ─── IS SPEAKING ──────────────────────────────────────────────────────────────
export const isSpeaking = () => window.speechSynthesis?.speaking || false

// ─── SPEAK FLUX MESSAGE ───────────────────────────────────────────────────────
// Convenience: speak a Flux message with correct voice for age group
export const speakFlux = (text, ageGroup = 'explorer', callbacks = {}) =>
  speak(text, { ageGroup, ...callbacks })

// ─── READ ALOUD ───────────────────────────────────────────────────────────────
// Read a longer passage with word highlighting support
export const readAloud = (text, ageGroup = 'explorer', onWord) =>
  speak(text, { ageGroup, rate: 0.85, onWord })

// ─── CHECK AVAILABILITY ───────────────────────────────────────────────────────
export const ttsAvailable = () => {
  return typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
}

// ─── GET AVAILABLE VOICES ────────────────────────────────────────────────────
export const getVoices = () => {
  loadVoices()
  return voiceList.filter(v => v.lang.startsWith('en'))
}

// ─── SPEAK WITH PHONEME PACING (for speech therapy exercises) ─────────────────
export const speakSlowly = (text, ageGroup = 'explorer') =>
  speak(text, { ageGroup, rate: 0.6, pitch: voiceSettings[ageGroup]?.pitch || 1.0 })

// ─── PRELOAD VOICES ───────────────────────────────────────────────────────────
export const preloadVoices = () => {
  // Trigger voice load on user gesture
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    window.speechSynthesis.speak(u)
    window.speechSynthesis.cancel()
    loadVoices()
  }
}
