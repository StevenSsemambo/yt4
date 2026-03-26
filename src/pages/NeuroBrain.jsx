import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSession, getSetting, setSetting } from '../utils/db'
import { useApp } from '../hooks/useAppContext'
import { getOfflineResponse } from '../ai/fluxEngine'
import Flux from '../components/flux/Flux'
import useFluxVoice from '../hooks/useFluxVoice'

const MODULES = [
  {
    id: 'what_is_stuttering', title: 'What is stuttering?', icon: '🧠', color: 'var(--aqua)', unlockAt: 0,
    cards: [
      { title: "It's neurological, not psychological", body: "Stuttering is caused by a disruption in the basal ganglia-thalamocortical circuit — the brain system that coordinates the precise timing and sequencing of motor movements. It's the same system that controls walking, typing, and other complex motor sequences. This means stuttering is a physical brain difference, not a character flaw or weakness.", insight: "Brain scans can literally see the stuttering circuit — it shows up on fMRI imaging." },
      { title: "The timing disruption", body: "When you speak, your brain must coordinate your lungs, vocal folds, tongue, lips, and jaw — simultaneously and in precise sequence — hundreds of times per minute. In people who stutter, the timing signal from the basal ganglia sometimes 'misfires', causing the motor sequence to stall, repeat, or freeze. This isn't laziness or nervousness causing the stutter. It's a timing signal.", insight: "The brain is doing something incredibly complex when you speak. A stutter is a slip in the timing, not a failure." },
      { title: "It often runs in families", body: "Stuttering has a strong genetic component. About 60% of people who stutter have a family member who also stutters. Several genes have been identified that affect basal ganglia function and are associated with stuttering. This confirms what research has long suggested: stuttering is inherited, not caused by parenting, trauma, or personality.", insight: "Having a family history of stuttering is actually evidence that it's a genuine neurological variation, not something you 'developed' from anxiety." },
      { title: "Why it gets better sometimes", body: "Most children who stutter (about 75-80%) naturally recover by their early teens — often without intervention. For those who don't, the circuit can still be rewired through intensive practice. Neuroplasticity — the brain's ability to reorganise itself — means that the pathway used for speech control can literally shift, with enough targeted practice.", insight: "Natural recovery happens. And for those who don't recover naturally, deliberate practice still changes the brain. The biology is on your side." },
    ]
  },
  {
    id: 'anxiety_connection', title: 'Anxiety & the stutter loop', icon: '💥', color: 'var(--rose)', unlockAt: 0,
    cards: [
      { title: "The amygdala hijack", body: "The amygdala — your brain's alarm system — is wired directly into the speech motor network. When you anticipate a difficult speaking situation, the amygdala fires. This floods your system with cortisol and adrenaline, tightens your muscles, and — critically — disrupts the timing signal that was already fragile. Anxiety doesn't cause stuttering, but it dramatically amplifies it.", insight: "This is why you might speak perfectly alone but struggle in conversation. The amygdala response is the difference." },
      { title: "Anticipatory anxiety", body: "People who stutter often develop anticipatory anxiety — a conditioned fear response to specific words, sounds, or situations. Before you've even started speaking, your brain has already 'predicted' a stutter and activated the stress response. This anticipation tightens your vocal folds and creates exactly the tension that causes the block you were afraid of. It becomes a self-fulfilling prophecy.", insight: "The fear creates the condition for the stutter. Breaking this loop is one of the most important goals of therapy." },
      { title: "The vagus nerve solution", body: "The vagus nerve is your body's main parasympathetic pathway — the 'calm down' signal. It runs from your brain directly to your heart, lungs, and gut. Extended exhalation (breathing out slowly for 6-8 counts) directly stimulates the vagus nerve, which reduces amygdala activation and lowers cortisol. This is the science behind why breathing exercises work. They're not just relaxation — they're neurological intervention.", insight: "Every time you do a slow extended exhale, you're actively calming the brain system that disrupts your speech." },
      { title: "Breaking the loop", body: "The anxiety-stutter loop can be broken at several points: before speaking (breathing exercises reduce amygdala activation), during speaking (acceptance reduces struggle behaviour), and after speaking (self-compassion instead of self-criticism prevents the loop from strengthening). Desensitisation — gradually exposing yourself to feared situations — physically rewires the amygdala's threat response over time.", insight: "Exposure therapy works because the amygdala physically downgrades the threat level of situations that repeatedly don't result in catastrophe." },
    ]
  },
  {
    id: 'neuroplasticity', title: 'How your brain changes', icon: '⚡', color: 'var(--jade)', unlockAt: 3,
    cards: [
      { title: "Neuroplasticity is real", body: "For most of human history, scientists believed the adult brain was fixed — that you were born with the neurons you'd always have. We now know this is completely wrong. The brain rewires itself throughout life in response to experience and practice. New synaptic connections form, existing ones strengthen, and unused ones prune away. Every speech practice session is literally changing the structure of your brain.", insight: "You are not stuck. Your brain at 30 is not the brain you'll have at 35 if you practice. This is documented in imaging studies." },
      { title: "Myelination and motor learning", body: "Myelin is a fatty sheath that wraps around nerve fibres and dramatically speeds up signal transmission. When you practise a motor skill repeatedly, the nerve pathways involved get progressively more myelinated. This is why skills feel 'automatic' after enough practice — the signal travels so fast it bypasses conscious control. Your fluency techniques will feel effortful at first, then habitual, then automatic. That transition is myelination happening.", insight: "The first 100 repetitions of a technique rewire the pathway. The next 100 strengthen it. Eventually it becomes default." },
      { title: "Sleep is speech therapy", body: "During deep sleep (specifically slow-wave and REM sleep), the hippocampus transfers motor memories into long-term cortical storage. This is called memory consolidation. The speech practice you did yesterday is being processed, strengthened, and stored tonight while you sleep. Skipping sleep significantly reduces the benefit of practice sessions — the learning doesn't consolidate properly. Sleep is not rest time from learning. It IS learning.", insight: "The session you did today is still working in your brain tonight. Sleep is not optional if you want to progress." },
      { title: "Hemispheric shift", body: "One of the most striking findings in stuttering neuroscience: people who stutter show overactivation of the right hemisphere for speech and underactivation of the left (particularly Broca's area and the supplementary motor area). Fluent speakers use the left hemisphere for speech control. Studies following intensive therapy show that successful outcomes correlate with measurable shifts of speech activation from right to left hemisphere — literally the brain reorganising its architecture.", insight: "Therapy outcomes can be seen on brain scans. The brain really does change. You can shift the circuit." },
    ]
  },
  {
    id: 'techniques_science', title: 'Why techniques work', icon: '🔬', color: 'var(--violet)', unlockAt: 5,
    cards: [
      { title: "The choral speech effect", body: "When people who stutter speak in unison with others, fluency dramatically increases — often to near-zero stuttering. This happens because choral speech activates the right hemisphere's auditory-motor integration pathway, which bypasses the disrupted left-hemisphere basal ganglia circuit. The brain essentially borrows a working pathway. DAF (Delayed Auditory Feedback) and rhythm/metronome therapy exploit this same mechanism.", insight: "Singing often produces the same effect. This is why you might be able to sing fluently even when speech is difficult." },
      { title: "Why easy onset works", body: "Hard glottal attacks — starting words with a sudden burst of air pressure — require rapid, high-intensity muscle coordination. This is exactly where the timing disruption causes problems. Easy onset (starting words with a gentle, soft breath) reduces the demand on the timing circuit, giving it more 'margin for error'. It doesn't eliminate the disruption, but it makes the disruption less likely to cause an observable block.", insight: "Easy onset is not about being gentle — it's about reducing the precision demand on a circuit that struggles with high-precision timing." },
      { title: "Voluntary stuttering's neuroscience", body: "When you stutter involuntarily, the amygdala activates (threat response) and the prefrontal cortex (rational brain) is suppressed. When you stutter on purpose, you activate the prefrontal cortex deliberately — you're in conscious control of what the amygdala usually 'hijacks'. Over repeated voluntary stutters, the amygdala's association between stuttering and threat physically weakens. The fear response declines. This is the neuroscience of desensitisation.", insight: "Voluntary stuttering is the most direct neurological intervention available without medication. It literally changes the amygdala's response." },
      { title: "Rate control's mechanism", body: "Speaking slower reduces the temporal demand on the motor planning system. Your brain needs to plan the movement for each sound slightly before it executes it. At fast rates, the planning time is very short, which increases errors. At slow rates, the planning window widens, reducing the probability of timing disruptions. It also increases auditory feedback processing time, which helps error detection and correction.", insight: "Slow speech isn't about effort — it's about giving the motor planning system the time it needs to sequence correctly." },
    ]
  },
  {
    id: 'identity_science', title: 'Identity & the iceberg', icon: '🧊', color: 'var(--amber)', unlockAt: 10,
    cards: [
      { title: "The iceberg model", body: "Joseph Sheehan's iceberg model describes stuttering as having a visible part (the actual disfluencies that listeners hear) and a much larger invisible part beneath the surface: the avoidances, the word substitutions, the situations escaped, the shame, the identity distortions, and the fear. Most people focus entirely on the visible tip and ignore the iceberg. But the iceberg is what limits life — not the stutter.", insight: "The stuttering you can hear is often not the problem. The avoidance you've built around it usually is." },
      { title: "Avoidance maintenance", body: "Behavioural neuroscience explains why avoidance is so persistent: every time you avoid a speaking situation, your brain releases a small dose of dopamine (relief from anticipated threat). This reward reinforces the avoidance behaviour, making it more likely you'll avoid again next time. Over time, your avoidance behaviour expands. You avoid more words, more situations, more people. This is how stuttering progressively limits life — through the avoidance, not the stutter.", insight: "Avoidance is self-maintaining. Each avoidance makes the next avoidance more likely, and the feared situation more threatening." },
      { title: "Identity and self-concept", body: "Prolonged experience with a condition that causes social difficulty will, over time, affect self-concept. Research on stuttering shows that many people who stutter develop a negative self-concept specifically around communication — seeing themselves as less intelligent, less competent, or less worthy of being heard. This identity belief then influences behaviour (avoid situations), which confirms the belief (I can't handle these situations), which deepens the identity. It's a loop.", insight: "Changing the self-concept — not just the speech — is a core part of sustainable recovery. That's why identity work matters." },
      { title: "The acceptance transformation", body: "Studies on quality of life for people who stutter consistently find that acceptance of stuttering — not fluency improvement — is the strongest predictor of life satisfaction and wellbeing. People who accept their stutter often report higher life satisfaction than people who achieve greater fluency but maintain shame and avoidance. The goal was never perfect speech. The goal was a full life.", insight: "Acceptance is not giving up on improvement. It's choosing to live fully while improvement happens at its own pace." },
    ]
  },
]

export default function NeuroBrain() {
  const [activeModule, setActiveModule] = useState(null)
  const [activeCard, setActiveCard] = useState(0)
  const [unlockedCards, setUnlockedCards] = useState({})
  const [totalSessions, setTotalSessions] = useState(0)
  const [fluxMsg, setFluxMsg] = useState(getOfflineResponse('science'))
  const navigate = useNavigate()
  const { profile, refreshProfile } = useApp()
  const { fluxSay } = useFluxVoice()
  const ag = profile?.ageGroup || 'explorer'

  useEffect(() => {
    const load = async () => {
      const unlocked = await getSetting('neurobrain_unlocked', {})
      const sessions = await getSetting('total_sessions_cache', 0)
      setUnlockedCards(unlocked || {})
      setTotalSessions(sessions || 0)
    }
    load()
  }, [])

  const openModule = async (mod) => {
    setActiveModule(mod)
    setActiveCard(0)
    if (!unlockedCards[mod.id]) {
      const updated = { ...unlockedCards, [mod.id]: true }
      setUnlockedCards(updated)
      await setSetting('neurobrain_unlocked', updated)
      await addSession('neurobrain', 70, { module: mod.id })
      refreshProfile()
    }
  }

  const handleNextCard = () => {
    if (activeCard < activeModule.cards.length - 1) {
      setActiveCard(c => c + 1)
    }
  }

  const isUnlocked = (mod) => totalSessions >= mod.unlockAt || unlockedCards[mod.id]

  return (
    <div className="relative min-h-full pb-28" style={{ zIndex: 1 }}>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate(-1)} className="w-9 h-9 glass rounded-xl flex items-center justify-center text-white/60">←</button>
          <div>
            <h1 className="text-xl font-bold font-display text-white">NeuroBrain</h1>
            <p className="text-xs text-white/40">The science behind your voice</p>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="card flex items-start gap-3">
          <div className="animate-flux-float flex-shrink-0">
            <Flux size={44} ageGroup={ag} mood="thinking" />
          </div>
          <p className="text-white/80 text-sm leading-relaxed">{fluxMsg}</p>
        </div>
      </div>

      {activeModule ? (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setActiveModule(null)} className="text-white/40 text-sm hover:text-white/70">← Modules</button>
            <span className="text-white/20">·</span>
            <span className="text-white/50 text-sm">{activeModule.title}</span>
          </div>

          {/* Card progress */}
          <div className="flex gap-1.5">
            {activeModule.cards.map((_, i) => (
              <button key={i} onClick={() => setActiveCard(i)}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{ background: i <= activeCard ? activeModule.color : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>

          {/* Active card */}
          {(() => {
            const card = activeModule.cards[activeCard]
            return (
              <div className="card-lg space-y-4 animate-scale-in">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeModule.icon}</span>
                  <h3 className="text-white font-bold">{card.title}</h3>
                </div>
                <p className="text-white/75 text-sm leading-[1.8]">{card.body}</p>
                <div className="glass rounded-xl p-4 border" style={{ borderColor: `${activeModule.color}30`, background: `${activeModule.color}08` }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: activeModule.color }}>Key insight</p>
                  <p className="text-white/70 text-sm leading-relaxed italic">{card.insight}</p>
                </div>
                <div className="flex gap-3">
                  {activeCard < activeModule.cards.length - 1 ? (
                    <button onClick={handleNextCard} className="flex-1 btn py-3 text-sm rounded-2xl font-semibold" style={{ background: activeModule.color, color: '#05080f' }}>
                      Next →
                    </button>
                  ) : (
                    <button onClick={() => setActiveModule(null)} className="flex-1 btn-jade py-3 text-sm">
                      ✓ Module complete
                    </button>
                  )}
                  {activeCard > 0 && (
                    <button onClick={() => setActiveCard(c => c - 1)} className="btn-ghost py-3 px-4 text-sm">←</button>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="card">
            <p className="text-white/70 text-sm leading-relaxed">
              Understanding the neuroscience behind your voice is powerful. Knowledge removes shame and replaces it with strategy. These modules unlock as you practice.
            </p>
          </div>

          {MODULES.map(mod => {
            const unlocked = isUnlocked(mod)
            const read = unlockedCards[mod.id]
            return (
              <button key={mod.id} onClick={() => unlocked && openModule(mod)}
                disabled={!unlocked}
                className={`w-full card-lg text-left transition-all ${unlocked ? 'hover:border-white/15 active:scale-95' : 'opacity-40'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${mod.color}15` }}>
                    {unlocked ? mod.icon : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-semibold text-sm">{mod.title}</p>
                      {read && <span className="text-jade text-xs">✓</span>}
                    </div>
                    <p className="text-white/40 text-xs">{mod.cards.length} cards</p>
                    {!unlocked && (
                      <p className="text-white/30 text-xs mt-0.5">Unlocks at {mod.unlockAt} sessions</p>
                    )}
                  </div>
                  {unlocked && <span className="text-white/30">→</span>}
                </div>
                {unlocked && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {mod.cards.map((card, i) => (
                      <span key={i} className="text-xs glass rounded-lg px-2 py-0.5 text-white/40 truncate max-w-[130px]">{card.title.slice(0, 20)}…</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}

          <div className="glass rounded-2xl p-4 border border-aqua/15">
            <p className="text-aqua/70 text-xs font-semibold mb-1">Why this matters</p>
            <p className="text-white/50 text-xs leading-relaxed">
              Research shows that people who understand the neuroscience of stuttering report significantly less shame, more effective technique use, and better long-term outcomes. Knowledge changes everything.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
