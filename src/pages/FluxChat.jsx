import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useAppContext'
import {
  callFluxAIStream,
  getIntelligentOfflineResponse,
  detectCommSkill,
  loadMemory,
  MemoryKeys,
} from '../ai/fluxEngine'
import { speak, stopSpeaking, speakFlux, ttsAvailable, preloadVoices } from '../ai/voiceEngine'
import Flux from '../components/flux/Flux'

const QUICK_PROMPTS = [
  "I'm nervous about something today",
  "Walk me through a breathing technique",
  "I need some real encouragement",
  "I had a rough speaking moment — help",
  "What should I focus on right now?",
  "I did something brave today ⭐",
  "Tell me something about my brain and stuttering",
  "I've been avoiding something and I know it",
]

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

function ReadAloudBtn({ text, ageGroup }) {
  const [active, setActive] = useState(false)
  if (!ttsAvailable()) return null
  const toggle = (e) => {
    e.stopPropagation()
    if (active) { stopSpeaking(); setActive(false) }
    else { setActive(true); speakFlux(text, ageGroup, { onEnd: () => setActive(false) }) }
  }
  return (
    <button onClick={toggle}
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all active:scale-90 ${active ? 'bg-cyan-400 text-white animate-pulse' : 'bg-white/10 text-white/30 hover:text-white/60'}`}
    >{active ? '⏹' : '🔊'}</button>
  )
}

function ThinkingBubble({ ageGroup }) {
  return (
    <div className="flex gap-2 items-end animate-fade-in">
      <Flux size={30} ageGroup={ageGroup} mood="thinking" />
      <div className="glass rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: 'var(--aqua)', opacity: 0.6, animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

export default function FluxChat() {
  const [messages, setMessages]         = useState([])
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming]    = useState(false)
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [fluxSpeaking, setFluxSpeaking] = useState(false)
  const [voiceMode, setVoiceMode]       = useState(false)
  const [interim, setInterim]           = useState('')
  const [autoSpeak, setAutoSpeak]       = useState(true)
  const [greetingDone, setGreetingDone] = useState(false)
  const chatRef  = useRef(null)
  const inputRef = useRef(null)
  const { profile, streak, totalSessions } = useApp()
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

  // Smart contextual greeting
  // Bug 2 fix: depend on `profile` so this runs once profile is loaded, not
  // on the first render when profile is still null.
  // Bug 5 fix: mounted ref prevents the StrictMode double-invoke from pushing
  // two greeting messages into state.
  useEffect(() => {
    if (!profile) return   // wait for context to load profile
    let mounted = true
    preloadVoices()
    const buildGreeting = async () => {
      const name = profile?.name || 'friend'
      const hour = new Date().getHours()
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
      const lastConvo = await loadMemory(MemoryKeys.CONVERSATION, [])
      const lastTurn = lastConvo.length > 0 ? lastConvo[lastConvo.length - 1] : null

      let greeting
      if (lastTurn && Date.now() - lastTurn.ts < 86400000) {
        const snippet = lastTurn.u.slice(0, 55) + (lastTurn.u.length > 55 ? '…' : '')
        greeting = `Hey ${name}. Good ${timeOfDay}. Last time you mentioned "${snippet}" — how did things go?`
      } else if ((streak || 0) > 7) {
        greeting = `${name}. ${streak} days straight. That's real commitment. Good ${timeOfDay} — what's on your mind?`
      } else if ((totalSessions || 0) === 0) {
        greeting = `Hey ${name}. I'm Flux — your guide in here. Good ${timeOfDay}. I want to hear about you before I suggest anything. What's going on with your speech right now?`
      } else if ((totalSessions || 0) > 0 && (streak || 0) === 0) {
        greeting = `${name}. Good to have you back. Good ${timeOfDay}. No guilt about any gaps — what do you want to work on?`
      } else {
        const opts = [
          `Good ${timeOfDay}, ${name}. What's been happening?`,
          `Hey ${name}. Good ${timeOfDay}. What's on your mind today?`,
          `${name}. Good ${timeOfDay}. What would be most useful right now?`,
        ]
        greeting = opts[Math.floor(Math.random() * opts.length)]
      }

      if (!mounted) return   // component unmounted (StrictMode cleanup) — bail out
      setMessages([{ role: 'assistant', text: greeting, id: 1 }])
      setGreetingDone(true)
      if (autoSpeak) {
        setTimeout(() => {
          if (!mounted) return
          setFluxSpeaking(true)
          speakFlux(greeting, ageGroup, { onEnd: () => setFluxSpeaking(false) })
        }, 700)
      }
    }
    buildGreeting()
    return () => { mounted = false; stopSpeaking() }
  }, [profile])  // re-run only when profile changes (i.e. once it loads)

  // Auto-scroll
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (nearBottom || isStreaming) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, streamingText, isStreaming])

  const sendMsg = async (text) => {
    const msg = typeof text === 'string' ? text : input.trim()
    if (!msg || loading || isStreaming) return
    setInput(''); setInterim('')
    stopSpeaking(); setFluxSpeaking(false)

    const userMsg = { role: 'user', text: msg, id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const commSkill = detectCommSkill(msg)
    const skillTag  = commSkill ? ` [SKILL:${commSkill}]` : ''
    const history   = [...messages, userMsg].map((m, i, arr) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: i === arr.length - 1 && m.role === 'user' ? m.text + skillTag : m.text,
    }))

    // Brief natural pause before responding
    await new Promise(r => setTimeout(r, 350 + Math.random() * 350))
    setLoading(false)
    setIsStreaming(true)
    setStreamingText('')

    let firstSentenceSpoken = false

    try {
      await callFluxAIStream(
        history,
        profile,
        (chunk, full) => {
          setStreamingText(full)
          // Speak first sentence as soon as it's complete
          if (autoSpeak && !firstSentenceSpoken && full.length > 60) {
            const sentEnd = full.search(/[.!?](\s|$)/)
            if (sentEnd > 30) {
              firstSentenceSpoken = true
              const firstSent = full.slice(0, sentEnd + 1)
              setFluxSpeaking(true)
              speakFlux(firstSent, ageGroup, { onEnd: () => setFluxSpeaking(false) })
            }
          }
        },
        ({ text, source }) => {
          setIsStreaming(false)
          setStreamingText('')
          const reply = { role: 'assistant', text, id: Date.now(), offline: source === 'offline' }
          setMessages(prev => [...prev, reply])
          if (autoSpeak && !firstSentenceSpoken) {
            setFluxSpeaking(true)
            speakFlux(text, ageGroup, {
              onEnd: () => {
                setFluxSpeaking(false)
                if (voiceMode) setTimeout(startListening, 700)
              }
            })
          } else if (voiceMode && !autoSpeak) {
            setTimeout(startListening, 700)
          }
        }
      )
    } catch {
      const fallback = await getIntelligentOfflineResponse(msg, profile)
      setIsStreaming(false)
      setStreamingText('')
      setMessages(prev => [...prev, { role: 'assistant', text: fallback, id: Date.now(), offline: true }])
      if (autoSpeak) {
        setFluxSpeaking(true)
        speakFlux(fallback, ageGroup, {
          onEnd: () => {
            setFluxSpeaking(false)
            if (voiceMode) setTimeout(startListening, 700)
          }
        })
      }
    }
  }

  const toggleVoiceMode = () => {
    if (voiceMode) { setVoiceMode(false); stopListening(); stopSpeaking(); setFluxSpeaking(false) }
    else { setVoiceMode(true); setAutoSpeak(true); startListening() }
  }

  const fluxMood = loading ? 'thinking' : isStreaming ? 'excited' : fluxSpeaking ? 'excited' : 'happy'

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--ink)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-12 pb-3 safe-top glass-dark border-b border-white/5">
        <button onClick={() => { stopSpeaking(); navigate(-1) }}
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white flex-shrink-0 active:scale-90 transition-all">←</button>

        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`flex-shrink-0 transition-all duration-300 ${(fluxSpeaking||isStreaming) ? 'scale-110' : 'scale-100'}`}>
            <Flux size={38} ageGroup={ageGroup} mood={fluxMood} speaking={fluxSpeaking||isStreaming} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-white text-sm">Flux</div>
            <div className="text-xs flex items-center gap-1.5">
              {fluxSpeaking ? (<><span className="w-1.5 h-1.5 rounded-full bg-aqua animate-pulse inline-block"/><span className="text-aqua">Speaking…</span></>)
               : isStreaming ? (<><span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{background:'var(--violet)'}}/><span style={{color:'var(--violet)'}}>Thinking…</span></>)
               : listening  ? (<><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block"/><span className="text-red-300">Listening…</span></>)
               : loading    ? (<><span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse inline-block"/><span className="text-white/40">Thinking…</span></>)
               : (<><span className="w-1.5 h-1.5 rounded-full bg-jade inline-block"/><span className="text-white/30">Ready</span></>)}
            </div>
          </div>
        </div>

        <button onClick={() => { setAutoSpeak(a => !a); if (fluxSpeaking) { stopSpeaking(); setFluxSpeaking(false) } }}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 ${autoSpeak ? 'bg-cyan-500/25 text-aqua' : 'bg-white/8 text-white/30'}`}
          title={autoSpeak ? 'Mute' : 'Unmute'}>{autoSpeak ? '🔊' : '🔇'}</button>

        <button onClick={toggleVoiceMode}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-display font-semibold transition-all active:scale-90 ${voiceMode ? 'bg-red-500 text-white' : 'bg-white/8 text-white/50'}`}>
          🎙️{voiceMode ? ' Live' : ''}
        </button>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 pt-4 space-y-4 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 items-end animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && <div className="flex-shrink-0 mb-1"><Flux size={30} ageGroup={ageGroup} mood="happy" /></div>}
            <div className={`flex flex-col gap-1 max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-cyan-500 text-white rounded-br-sm' : 'glass text-white/90 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 px-1">
                  <ReadAloudBtn text={msg.text} ageGroup={ageGroup} />
                  {msg.offline && <span className="text-white/20 text-[10px]">· offline</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming text bubble */}
        {isStreaming && (
          <div className="flex gap-2 items-end animate-fade-in">
            <div className="flex-shrink-0 mb-1"><Flux size={30} ageGroup={ageGroup} mood="excited" speaking={true} /></div>
            <div className="flex flex-col gap-1 max-w-[82%] items-start">
              <div className="glass rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-white/90" style={{ minHeight: '44px' }}>
                {streamingText}
                <span className="inline-block w-0.5 h-4 bg-aqua ml-0.5 align-middle rounded-full animate-record" />
              </div>
            </div>
          </div>
        )}

        {loading && !isStreaming && <ThinkingBubble ageGroup={ageGroup} />}

        {interim && (
          <div className="flex justify-end animate-fade-in">
            <div className="rounded-2xl rounded-br-sm px-4 py-2 text-sm text-white/50 italic max-w-[75%]"
              style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
              {interim}…
            </div>
          </div>
        )}
        <div className="h-2" />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && greetingDone && !voiceMode && (
        <div className="flex-shrink-0 px-4 pb-2">
          <p className="text-white/20 text-[10px] uppercase tracking-widest mb-2 font-display">Quick starters</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMsg(p)}
                className="flex-shrink-0 text-xs px-3 py-2 rounded-full transition-all active:scale-95 whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 glass-dark border-t border-white/5 safe-bottom">
        {voiceMode ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              {listening && <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(239,68,68,0.3)', animationDuration: '1.2s' }}/>}
              <button
                onPointerDown={startListening} onPointerUp={stopListening} onPointerLeave={stopListening}
                className="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-2xl transition-all active:scale-95"
                style={{
                  background: listening ? '#ef4444' : 'var(--aqua)',
                  boxShadow: listening ? '0 8px 32px rgba(239,68,68,0.4)' : '0 8px 32px rgba(34,211,238,0.35)',
                  transform: listening ? 'scale(1.08)' : 'scale(1)',
                }}>
                {listening ? '⏺' : '🎙️'}
              </button>
            </div>
            <p className="text-white/30 text-xs">{listening ? 'Listening — release to send' : 'Hold to speak to Flux'}</p>
            <div className="flex gap-2">
              {fluxSpeaking && (
                <button onClick={() => { stopSpeaking(); setFluxSpeaking(false) }}
                  className="text-xs px-3 py-1.5 rounded-full active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                  ⏹ Stop Flux
                </button>
              )}
              <button onClick={toggleVoiceMode}
                className="text-xs px-3 py-1.5 rounded-full active:scale-95"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                ⌨️ Type instead
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            {micOk && (
              <button
                onPointerDown={startListening} onPointerUp={stopListening} onPointerLeave={stopListening}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 transition-all active:scale-90"
                style={{
                  background: listening ? '#ef4444' : 'rgba(255,255,255,0.08)',
                  color: listening ? 'white' : 'rgba(255,255,255,0.5)',
                  animation: listening ? 'recordBlink 1s ease-in-out infinite' : 'none',
                }}>
                {listening ? '⏺' : '🎙️'}
              </button>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder={listening ? '🎙️ Listening…' : 'Talk to Flux…'}
              rows={1}
              className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none leading-relaxed"
              style={{
                minHeight: '44px', maxHeight: '120px', resize: 'none',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)',
                color: 'rgba(255,255,255,0.92)', caretColor: 'var(--aqua)',
                fontFamily: '"DM Sans", sans-serif', WebkitOverflowScrolling: 'touch',
              }}
            />
            <button
              onClick={() => sendMsg()}
              disabled={!input.trim() || loading || isStreaming}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-all flex-shrink-0"
              style={{ background: 'var(--aqua)', boxShadow: '0 4px 20px rgba(34,211,238,0.25)' }}>
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
