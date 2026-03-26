import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, addRecording, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { continueStory, getOfflineResponse } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const STORY_STARTERS = [
  { title: 'The Door in the Tree', opener: "Deep in the Whispering Forest, a small bear discovered something no one had ever found before — a tiny purple door built into the bark of the oldest oak. The bear took a breath, pressed their paw on the handle, and...", genre: '🌲 Fantasy' },
  { title: 'The Robot\'s Secret', opener: "The robot had been in the school for three years, helping students with homework. But today, for the very first time, it raised its hand to ask a question — not answer one. It said:", genre: '🤖 Sci-Fi' },
  { title: 'The Last Bookshop', opener: "In the whole city, only one bookshop was left. And that bookshop had a cat who knew the ending of every story ever written. When a child walked in and said 'tell me my story', the cat looked up slowly and...", genre: '📚 Mystery' },
  { title: 'Cloud Chasers', opener: "Two clouds had been chasing each other across the sky for one hundred years. Today, the faster cloud finally caught up. Breathless (if clouds breathe), it said:", genre: '☁️ Whimsy' },
  { title: 'Message in a Jar', opener: "The jar washed up on the beach with a glowing blue note inside. When I opened it, the words rearranged themselves into a question — a question meant only for me. The question was:", genre: '🌊 Adventure' },
  { title: 'The Talking Map', opener: "The old map had been folded in the drawer for thirty years. But last Tuesday, it started talking. In a crackling, papery voice, it said it had been waiting for someone brave enough to follow it. It asked:", genre: '🗺️ Quest' },
]

export default function TalkTales() {
  const [stage, setStage] = useState('menu') // menu | story | done
  const [selectedStory, setSelectedStory] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const [recordings, setRecordings] = useState([])
  const chatRef = useRef(null)
  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const navigate = useNavigate()
  const { triggerFlux, refreshProfile, profile } = useApp()
  const { fluxSay, fluxStop, fluxSpeaking } = useFluxVoice()

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  const startStory = (story) => {
    setSelectedStory(story)
    setMessages([{ role: 'flux', text: story.opener, isOpener: true }])
    setTurnCount(0)
    setStage('story')
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', text: input.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setTurnCount(t => t + 1)
    setLoading(true)

    // Build message history for AI
    const aiMessages = newHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    }))

    try {
      const continuation = await continueStory(
        input.trim(),
        aiMessages.slice(-6), // keep last 6 for context
        profile
      )
      setMessages(h => [...h, { role: 'flux', text: continuation }])
    } catch {
      setMessages(h => [...h, { role: 'flux', text: getOfflineResponse('story_prompts') }])
    }
    setLoading(false)
  }

  const startVoiceRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecRef.current = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRecRef.current.ondataavailable = e => chunksRef.current.push(e.data)
      mediaRecRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setRecordings(r => [...r, { url, blob, timestamp: Date.now() }])
        await addRecording('talktales', blob, 0, selectedStory?.title || 'story')
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecRef.current.start()
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }

  const stopVoiceRecord = () => {
    mediaRecRef.current?.stop()
    setRecording(false)
  }

  const finishStory = async () => {
    await addSession('talktales', turnCount * 5 + 20, { turns: turnCount, story: selectedStory?.title })
    await markTodayStreak()
    await refreshProfile()
    triggerFlux(getOfflineResponse('celebration'))
    setStage('done')
  }

  return (
    <div className="min-h-full pb-24 page-enter">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => { setStage('menu'); navigate(stage === 'menu' ? -1 : undefined) }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white flex-1">TalkTales</h1>
        <span className="text-2xl">📖</span>
      </div>

      {/* Menu */}
      {stage === 'menu' && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-6">
            <Flux size={80} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating
              showMessage message="Choose a story and let's build it together! No wrong answers. Just flow. 📖" />
          </div>
          <h2 className="font-display font-semibold text-white/70 text-sm mb-3 uppercase tracking-wider">Choose a Story</h2>
          <div className="space-y-3">
            {STORY_STARTERS.map((s, i) => (
              <button
                key={i}
                onClick={() => startStory(s)}
                className="w-full p-4 rounded-2xl border border-white/10 bg-white/5 text-left
                           active:scale-[0.98] transition-transform hover:bg-white/8"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-display font-bold text-white">{s.title}</span>
                  <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{s.genre}</span>
                </div>
                <p className="text-white/50 text-sm line-clamp-2">{s.opener}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-violet-500/10 border border-bloom-500/20">
            <p className="text-bloom-300 text-sm">💡 <strong>No pressure.</strong> There's no timer, no wrong answers, and no judging. Just you, Flux, and a story waiting to be told.</p>
          </div>
        </div>
      )}

      {/* Story Mode */}
      {stage === 'story' && (
        <div className="flex flex-col h-[calc(100vh-140px)]">
          <div className="px-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">{selectedStory?.title}</span>
              <span className="text-white/30 text-xs">{turnCount} turns</span>
            </div>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto px-5 space-y-4 scrollbar-hide pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'flux' && (
                  <div className="flex-shrink-0 mt-1">
                    <Flux size={40} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-500 text-white rounded-tr-sm'
                    : msg.isOpener
                    ? 'bg-violet-500/20 border border-bloom-500/30 text-white/90 rounded-tl-sm italic'
                    : 'glass text-white/90 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <Flux size={40} ageGroup={profile?.ageGroup || 'explorer'} mood="thinking" />
                <div className="glass rounded-2xl px-4 py-3 flex gap-1 items-center">
                  <span className="text-white/40 text-xs mr-2">Flux is writing...</span>
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="px-5 py-3 glass-dark space-y-2">
            {/* Voice recordings */}
            {recordings.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {recordings.map((r, i) => (
                  <audio key={i} src={r.url} controls className="h-8 min-w-[140px] opacity-70" />
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onPointerDown={startVoiceRecord}
                onPointerUp={stopVoiceRecord}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all
                  ${recording ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60'}`}
              >
                {recording ? '⏺' : '🎙️'}
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Continue the story..."
                className="flex-1 bg-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none border border-white/10 focus:border-cyan-400"
              />
              <button onClick={handleSend} disabled={!input.trim() || loading}
                className="btn-aqua px-4 py-2.5 text-sm disabled:opacity-50">
                →
              </button>
            </div>
            {turnCount >= 3 && (
              <button onClick={finishStory}
                className="w-full text-xs text-jade border border-spark-400/20 py-2 rounded-xl hover:bg-jade/10">
                Finish Story & Save ✓
              </button>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="flex flex-col items-center px-5 py-8 gap-6 text-center">
          <Flux size={120} ageGroup={profile?.ageGroup || 'explorer'} mood="excited" floating />
          <div>
            <div className="text-5xl mb-3">📖✨</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Story Complete!</h2>
            <p className="text-white/60">You told a story across {turnCount} turns. Your voice, your words, your bravery. +{turnCount * 5 + 20} stars!</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => setStage('menu')} className="btn-ghost flex-1">Another Story</button>
            <button onClick={() => navigate('/home')} className="btn-aqua flex-1">Back Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
