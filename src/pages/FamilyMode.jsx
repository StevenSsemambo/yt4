import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, markTodayStreak } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'
import { speak } from '../ai/voiceEngine'

const CO_READ_PASSAGES = [
  {
    title: 'The River Song',
    lines: [
      { speaker: 'parent', text: 'The river flows gently through the green valley,' },
      { speaker: 'child', text: 'and carries the songs of the mountains with it.' },
      { speaker: 'parent', text: 'Every stone it passes becomes a little smoother,' },
      { speaker: 'child', text: 'and every bend it takes makes it a little stronger.' },
      { speaker: 'parent', text: 'The river never stops,' },
      { speaker: 'child', text: 'because flow is what rivers do best.' },
    ]
  },
  {
    title: 'The Brave Explorer',
    lines: [
      { speaker: 'parent', text: 'Once there was an explorer who was afraid of the dark forest.' },
      { speaker: 'child', text: 'But she walked in anyway, one careful step at a time.' },
      { speaker: 'parent', text: 'The trees whispered her name as she passed,' },
      { speaker: 'child', text: 'and the shadows became her friends.' },
      { speaker: 'parent', text: 'She discovered something wonderful at the center:' },
      { speaker: 'child', text: 'the forest was brave because she was.' },
    ]
  },
  {
    title: 'Two Voices, One Song',
    lines: [
      { speaker: 'parent', text: 'I speak, and my voice makes waves in the air.' },
      { speaker: 'child', text: 'I speak, and my voice reaches every ear.' },
      { speaker: 'parent', text: 'Together we make more music than one voice can.' },
      { speaker: 'child', text: 'Together we find the flow that lives in all words.' },
      { speaker: 'parent', text: 'Your voice is beautiful.' },
      { speaker: 'child', text: 'My voice is mine, and it is enough.' },
    ]
  },
]

const PARENT_TIPS = [
  { tip: "When your child stutters, keep your face relaxed and maintain eye contact. Your calm is contagious.", icon: '😌' },
  { tip: "Respond to WHAT your child says, not HOW they say it. Their message matters more than their fluency.", icon: '💬' },
  { tip: "Slow your own speech slightly when talking with your child. It naturally creates a calmer speaking environment.", icon: '🐢' },
  { tip: "Never finish your child's sentences or tell them to slow down. Let them complete every word at their own pace.", icon: '⏳' },
  { tip: "Praise attempts and bravery, not fluency. Say 'I loved what you said' not 'You spoke so well today.'", icon: '🌟' },
  { tip: "Research shows children who stutter benefit hugely from co-reading with a parent. Even 5 minutes counts!", icon: '📖' },
  { tip: "Avoid asking your child to repeat themselves unless you genuinely didn't understand. Repeated requests increase pressure.", icon: '🔇' },
  { tip: "Create low-pressure speaking moments: cooking together, car rides, bedtime chat. These are the best practice grounds.", icon: '🚗' },
]

export default function FamilyMode() {
  const [stage, setStage] = useState('menu') // menu | coread | tip | celebrate
  const [selectedPassage, setSelectedPassage] = useState(null)
  const [currentLine, setCurrentLine] = useState(0)
  const [activeSpeaker, setActiveSpeaker] = useState(null)
  const [completedLines, setCompletedLines] = useState([])
  const [currentTip] = useState(PARENT_TIPS[Math.floor(Math.random() * PARENT_TIPS.length)])
  const navigate = useNavigate()
  const { triggerFlux, refreshProfile, profile } = useApp()
  const { fluxSay } = useFluxVoice()
  const readLineAloud = async (text, speaker) => {
    const ag = speaker === 'child' ? (profile?.ageGroup || 'explorer') : 'adult'
    await speak(text, { ageGroup: ag, rate: 0.8 })
  }

  const startCoRead = (passage) => {
    setSelectedPassage(passage)
    setCurrentLine(0)
    setCompletedLines([])
    setActiveSpeaker(passage.lines[0].speaker)
    setStage('coread')
  }

  const handleLineComplete = async () => {
    const line = selectedPassage.lines[currentLine]
    setCompletedLines(prev => [...prev, currentLine])

    if (currentLine < selectedPassage.lines.length - 1) {
      const next = currentLine + 1
      setCurrentLine(next)
      setActiveSpeaker(selectedPassage.lines[next].speaker)
    } else {
      // All done
      await addSession('family', 40, { passage: selectedPassage.title })
      await markTodayStreak()
      await refreshProfile()
      triggerFlux(getOfflineResponse('celebration'))
      setStage('celebrate')
    }
  }

  return (
    <div className="min-h-full pb-24 page-enter">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button onClick={() => { setStage('menu'); navigate(stage === 'menu' ? -1 : undefined) }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">←</button>
        <h1 className="font-display text-xl font-bold text-white flex-1">Family Mode</h1>
        <span className="text-2xl">👨‍👩‍👧</span>
      </div>

      {stage === 'menu' && (
        <div className="px-5">
          <div className="flex flex-col items-center mb-6">
            <Flux size={90} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating
              showMessage message="Family time! Reading together creates the choral effect — up to 97% fluency improvement. 💙" />
          </div>

          {/* Co-Reading */}
          <h2 className="font-display font-semibold text-white/70 text-sm mb-3 uppercase tracking-wider">
            Co-Reading Passages
          </h2>
          <div className="space-y-3 mb-6">
            {CO_READ_PASSAGES.map((p, i) => (
              <button
                key={i}
                onClick={() => startCoRead(p)}
                className="w-full p-4 rounded-2xl border border-white/10 bg-white/5 text-left
                           active:scale-[0.98] transition-transform hover:bg-white/8 flex items-center gap-4"
              >
                <div className="text-3xl">📖</div>
                <div>
                  <div className="font-display font-bold text-white">{p.title}</div>
                  <div className="text-white/40 text-sm">{p.lines.length} lines · {Math.ceil(p.lines.length / 2)} min</div>
                </div>
                <div className="ml-auto text-white/30">→</div>
              </button>
            ))}
          </div>

          {/* Today's Parent Tip */}
          <h2 className="font-display font-semibold text-white/70 text-sm mb-3 uppercase tracking-wider">Today's Parent Tip</h2>
          <div className="card border border-cyan-500/20 bg-cyan-500/5">
            <div className="flex gap-3">
              <div className="text-2xl">{currentTip.icon}</div>
              <p className="text-white/80 text-sm leading-relaxed">{currentTip.tip}</p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-spark-500/10 border border-spark-500/20">
            <h3 className="font-display font-semibold text-spark-300 mb-2">📊 Why Co-Reading Works</h3>
            <p className="text-white/60 text-sm">Research shows choral reading — where two people read together — reduces stuttering by up to 97%. It's the most clinically effective fluency technique available, and you create it naturally every time you read together.</p>
          </div>

          {/* All Tips */}
          <div className="mt-6">
            <h2 className="font-display font-semibold text-white/70 text-sm mb-3 uppercase tracking-wider">All Parent Tips</h2>
            <div className="space-y-2">
              {PARENT_TIPS.map((tip, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-xl flex-shrink-0">{tip.icon}</span>
                  <p className="text-white/60 text-sm leading-relaxed">{tip.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === 'coread' && selectedPassage && (
        <div className="px-5 flex flex-col gap-5">
          <div className="text-center">
            <h2 className="font-display text-xl font-bold text-white">{selectedPassage.title}</h2>
            <p className="text-white/40 text-sm">Line {currentLine + 1} of {selectedPassage.lines.length}</p>
          </div>

          {/* Progress */}
          <div className="flex gap-1.5">
            {selectedPassage.lines.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                completedLines.includes(i) ? 'bg-jade' : i === currentLine ? 'bg-cyan-400' : 'bg-white/15'
              }`} />
            ))}
          </div>

          {/* Completed lines */}
          {completedLines.length > 0 && (
            <div className="space-y-2">
              {completedLines.map(idx => {
                const line = selectedPassage.lines[idx]
                return (
                  <div key={idx} className={`px-4 py-2 rounded-xl text-sm opacity-50 ${
                    line.speaker === 'parent' ? 'text-right text-aqua' : 'text-left text-spark-300'
                  }`}>
                    <span className="text-white/30 text-xs">{line.speaker === 'parent' ? '👨‍👩‍👧 Parent: ' : '🧒 Child: '}</span>
                    "{line.text}"
                  </div>
                )
              })}
            </div>
          )}

          {/* Current line */}
          <div className={`p-5 rounded-2xl border-2 ${
            activeSpeaker === 'parent'
              ? 'border-cyan-400 bg-cyan-400/10'
              : 'border-spark-400 bg-jade/10'
          }`}>
            <div className={`text-sm font-bold mb-3 ${activeSpeaker === 'parent' ? 'text-aqua' : 'text-jade'}`}>
              {activeSpeaker === 'parent' ? '👨‍👩‍👧 Parent reads:' : '🧒 Child reads:'}
            </div>
            <p className="font-display text-white text-xl leading-relaxed">
              "{selectedPassage.lines[currentLine].text}"
            </p>
            <button
              onClick={() => readLineAloud(selectedPassage.lines[currentLine].text, selectedPassage.lines[currentLine].speaker)}
              className="mt-2 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
            >🔊 Hear this line</button>
          </div>

          {/* Flux */}
          <div className="flex justify-center">
            <Flux size={70} ageGroup={profile?.ageGroup || 'explorer'} mood="happy" floating />
          </div>

          <button onClick={handleLineComplete} className="btn-aqua w-full py-4 text-lg">
            {currentLine < selectedPassage.lines.length - 1 ? 'Line Read ✓ → Next' : 'Complete Reading 🎉'}
          </button>

          <p className="text-center text-white/30 text-xs">Take your time. Breathe before each line. No rush.</p>
        </div>
      )}

      {stage === 'celebrate' && (
        <div className="flex flex-col items-center px-5 py-8 gap-6 text-center">
          <Flux size={130} ageGroup={profile?.ageGroup || 'explorer'} mood="excited" floating />
          <div>
            <div className="text-5xl mb-3">👨‍👩‍👧💙</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Family Session Complete!</h2>
            <p className="text-white/60">You just created the choral reading effect together. That's real science and real love in action. +40 stars!</p>
          </div>
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 w-full">
            <p className="text-aqua text-sm">💡 <strong>Research says:</strong> The most important thing a parent can do after co-reading is respond warmly to what their child said — not how they said it.</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={() => setStage('menu')} className="btn-ghost flex-1">Read Again</button>
            <button onClick={() => navigate('/home')} className="btn-aqua flex-1">Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
