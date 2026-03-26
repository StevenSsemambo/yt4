import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useAppContext'
import { callFluxAI, getOfflineResponse, detectContext, detectCommSkill } from '../ai/fluxEngine'
import { speak, stopSpeaking, speakFlux, ttsAvailable, preloadVoices } from '../ai/voiceEngine'
import Flux from '../components/flux/Flux'

const QUICK_PROMPTS = [
  "I'm nervous about speaking today 😟",
  "Give me a breathing tip 💨",
  "I need encouragement 💙",
  "I just stuttered badly — help",
  "What should I practice today?",
  "I did something brave today! ⭐",
]

// ─── SPEECH RECOGNITION ────────────────────────────────────────────────────────
function useSpeechRecognition(onResult, onEnd) {
  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    setSupported(true)
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      const final = e.results[e.results.length - 1].isFinal
      onResult(transcript, final)
    }
    rec.onend = () => { setListening(false); onEnd?.() }
    rec.onerror = () => setListening(false)
    recRef.current = rec
  }, [])

  const startListening = useCallback(() => {
    if (!recRef.current || listening) return
    stopSpeaking()
    try { recRef.current.start(); setListening(true) } catch {}
  }, [listening])

  const stopListening = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    setListening(false)
  }, [])

  return { listening, supported, startListening, stopListening }
}

// ─── INLINE SPEAK BUTTON ──────────────────────────────────────────────────────
function ReadAloudBtn({ text, ageGroup }) {
  const [active, setActive] = useState(false)
  if (!ttsAvailable()) return null
  const toggle = (e) => {
    e.stopPropagation()
    if (active) { stopSpeaking(); setActive(false) }
    else {
      setActive(true)
      speakFlux(text, ageGroup, { onEnd: () => setActive(false) })
    }
  }
  return (
    <button
      onClick={toggle}
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all active:scale-90 ${
        active ? 'bg-cyan-400 text-white animate-pulse' : 'bg-white/10 text-white/30 hover:text-white/60'
      }`}
      title={active ? 'Stop' : 'Read aloud'}
    >{active ? '⏹' : '🔊'}</button>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function FluxChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fluxSpeaking, setFluxSpeaking] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [interim, setInterim] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const chatRef = useRef(null)
  const { profile } = useApp()
  const navigate = useNavigate()
  const ageGroup = profile?.ageGroup || 'explorer'

  const { listening, supported: micOk, startListening, stopListening } =
    useSpeechRecognition(
      (text, final) => {
        setInput(text)
        if (final && text.trim()) { setInterim(''); sendMsg(text.trim()) }
        else setInterim(text)
      },
      () => setInterim('')
    )

  // Initial greeting
  useEffect(() => {
    preloadVoices()
    const greeting = getOfflineResponse(detectContext({ sessionCount: 1, streakDays: 1 }))
    const msg = { role: 'assistant', text: greeting, id: 1 }
    setMessages([msg])
    setTimeout(() => {
      setFluxSpeaking(true)
      speakFlux(greeting, ageGroup, { onEnd: () => setFluxSpeaking(false) })
    }, 700)
    return () => stopSpeaking()
  }, [])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const sendMsg = async (text) => {
    const msg = typeof text === 'string' ? text : input.trim()
    if (!msg || loading) return
    setInput(''); setInterim('')
    stopSpeaking(); setFluxSpeaking(false)

    const userMsg = { role: 'user', text: msg, id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const commSkill = detectCommSkill(msg)
    const skillTag = commSkill ? ` [SKILL:${commSkill}]` : ''

    const history = [...messages, userMsg].map((m, i, arr) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (i === arr.length - 1 && m.role === 'user') ? m.text + skillTag : m.text
    }))

    try {
      const result = await callFluxAI(history, profile)
      const reply = { role: 'assistant', text: result.text, id: Date.now(), offline: result.source === 'offline' }
      setMessages(prev => [...prev, reply])
      setLoading(false)

      if (autoSpeak) {
        setTimeout(() => {
          setFluxSpeaking(true)
          speakFlux(result.text, ageGroup, {
            onEnd: () => {
              setFluxSpeaking(false)
              if (voiceMode) setTimeout(startListening, 600)
            }
          })
        }, 150)
      }
    } catch {
      const fallback = getOfflineResponse('general')
      setMessages(prev => [...prev, { role: 'assistant', text: fallback, id: Date.now(), offline: true }])
      setLoading(false)
    }
  }

  const toggleVoiceMode = () => {
    if (voiceMode) { setVoiceMode(false); stopListening(); stopSpeaking(); setFluxSpeaking(false) }
    else { setVoiceMode(true); setAutoSpeak(true); startListening() }
  }

  return (
    <div className="flex flex-col bg-ink" style={{ height: '100dvh' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 pt-12 safe-top glass-dark border-b border-white/5">
        <button onClick={() => { stopSpeaking(); navigate(-1) }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white flex-shrink-0">←</button>

        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`flex-shrink-0 transition-transform duration-300 ${fluxSpeaking ? 'scale-110' : 'scale-100'}`}>
            <Flux size={38} ageGroup={ageGroup}
              mood={loading ? 'thinking' : fluxSpeaking ? 'excited' : 'happy'}
              speaking={fluxSpeaking} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-white text-sm">Flux</div>
            <div className="text-xs flex items-center gap-1.5">
              {fluxSpeaking ? (<><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block"/><span className="text-aqua">Speaking…</span></>)
               : listening ? (<><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block"/><span className="text-red-300">Listening…</span></>)
               : loading  ? (<><span className="w-1.5 h-1.5 rounded-full bg-bloom-400 animate-pulse inline-block"/><span className="text-white/40">Thinking…</span></>)
               : (<><span className="w-1.5 h-1.5 rounded-full bg-jade inline-block"/><span className="text-white/30">Ready to flow</span></>)}
            </div>
          </div>
        </div>

        {/* Auto-speak toggle */}
        <button onClick={() => { setAutoSpeak(a => !a); if (fluxSpeaking) { stopSpeaking(); setFluxSpeaking(false) } }}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${autoSpeak ? 'bg-cyan-500/30 text-aqua' : 'bg-white/8 text-white/30'}`}
          title={autoSpeak ? 'Mute Flux' : 'Unmute Flux'}>
          {autoSpeak ? '🔊' : '🔇'}
        </button>

        {/* Voice mode */}
        <button onClick={toggleVoiceMode}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-display font-semibold transition-all ${
            voiceMode ? 'bg-red-500 text-white' : 'bg-white/10 text-white/50'}`}>
          {voiceMode ? '🎙️ Live' : '🎙️'}
        </button>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 items-end animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 mb-1">
                <Flux size={30} ageGroup={ageGroup} mood="happy" />
              </div>
            )}
            <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-500 text-white rounded-br-sm'
                  : 'glass text-white/90 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 px-1">
                  <ReadAloudBtn text={msg.text} ageGroup={ageGroup} />
                  {msg.offline && <span className="text-white/20 text-xs">· offline</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-end animate-fade-in">
            <Flux size={30} ageGroup={ageGroup} mood="thinking" />
            <div className="glass rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
            </div>
          </div>
        )}

        {interim && (
          <div className="flex justify-end animate-fade-in">
            <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-2xl rounded-br-sm px-4 py-2 text-sm text-white/50 italic max-w-[75%]">
              {interim}…
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Prompts ────────────────────────────────────────────────── */}
      {messages.length <= 2 && !voiceMode && (
        <div className="flex-shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => sendMsg(p)}
              className="flex-shrink-0 text-xs px-3 py-2 rounded-full bg-white/8 border border-white/10
                         text-white/50 hover:bg-white/15 active:scale-95 transition-all whitespace-nowrap">
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 glass-dark border-t border-white/5 safe-bottom">
        {voiceMode ? (
          /* Voice-only UI */
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerLeave={stopListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-2xl
                transition-all active:scale-95 ${listening
                  ? 'bg-red-500 shadow-red-500/40 scale-110'
                  : 'bg-cyan-500 shadow-cyan-500/40 hover:bg-cyan-400'}`}>
              {listening ? '⏺' : '🎙️'}
            </button>
            <p className="text-white/30 text-xs">{listening ? 'Listening — release to send' : 'Hold to speak to Flux'}</p>
            <div className="flex gap-2">
              {fluxSpeaking && (
                <button onClick={() => { stopSpeaking(); setFluxSpeaking(false) }}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white/40 active:scale-95">
                  ⏹ Stop Flux
                </button>
              )}
              <button onClick={toggleVoiceMode}
                className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white/40 active:scale-95">
                ⌨️ Type instead
              </button>
            </div>
          </div>
        ) : (
          /* Text + mic UI */
          <div className="flex gap-2 items-end">
            {micOk && (
              <button
                onPointerDown={startListening}
                onPointerUp={stopListening}
                onPointerLeave={stopListening}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0
                  transition-all active:scale-90 ${listening
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                    : 'bg-white/10 text-white/50 hover:bg-white/15'}`}>
                {listening ? '⏺' : '🎙️'}
              </button>
            )}

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder={listening ? '🎙️ Listening…' : 'Talk to Flux…'}
              rows={1}
              className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none resize-none leading-relaxed transition-colors"
              style={{
                minHeight: '44px', maxHeight: '120px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.92)',
                caretColor: '#22d3ee',
              }}
            />

            <button
              onClick={() => sendMsg()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-2xl bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center
                         text-white disabled:opacity-30 active:scale-90 transition-all flex-shrink-0
                         shadow-lg shadow-cyan-500/20 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
