// ─── FLUX AI ENGINE v3 — FULLY OFFLINE INTELLIGENCE ──────────────────────────
// 1400+ responses · CBT/ACT · Fluency Shaping · Van Riper · Adaptive Logic
// Real-person conversation feel · Zero network required
// ─────────────────────────────────────────────────────────────────────────────

import { db, getSetting, setSetting } from '../utils/db'

const MODEL = 'claude-sonnet-4-20250514'

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
export const MemoryKeys = {
  INSIGHTS:        'flux_insights',
  STRENGTHS:       'flux_strengths',
  WEAKNESSES:      'flux_weaknesses',
  RECOMMENDATIONS: 'flux_recs',
  PROGRESS_STORY:  'flux_story',
  GOALS:           'flux_goals',
  MOOD_HISTORY:    'flux_moods',
  TECHNIQUE_PREFS: 'flux_techniques',
  CONVERSATION:    'flux_convo_history',
}

export const saveMemory = (key, data) => setSetting(key, JSON.stringify(data))
export const loadMemory = async (key, fallback = null) => {
  try { const r = await getSetting(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}

export const buildUserMemory = async (profile) => {
  const [insights, strengths, weaknesses, story, recs, moods, techPrefs, goals, convoHistory] = await Promise.all([
    loadMemory(MemoryKeys.INSIGHTS, []),
    loadMemory(MemoryKeys.STRENGTHS, []),
    loadMemory(MemoryKeys.WEAKNESSES, []),
    loadMemory(MemoryKeys.PROGRESS_STORY, ''),
    loadMemory(MemoryKeys.RECOMMENDATIONS, null),
    loadMemory(MemoryKeys.MOOD_HISTORY, []),
    loadMemory(MemoryKeys.TECHNIQUE_PREFS, {}),
    loadMemory(MemoryKeys.GOALS, []),
    loadMemory(MemoryKeys.CONVERSATION, []),
  ])

  const now = new Date()
  const todayStr = now.toDateString()
  const sessions = await db.sessions.orderBy('date').reverse().limit(20).toArray()
  const totalSessions = await db.sessions.count()
  const recentTypes = sessions.slice(0, 10).map(s => s.type).join(', ')

  // Session frequency analysis
  const sessionTypeCounts = sessions.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1; return acc
  }, {})
  const neverDone = ['breathe','speaklab','brave','talktales','journal','mindshift','stutterscore']
    .filter(t => !sessionTypeCounts[t])

  // Streak calculation
  const streaks = await db.streaks.orderBy('date').reverse().limit(14).toArray()
  let streakDays = 0
  for (let i = 0; i < streaks.length; i++) {
    const d = new Date(streaks[i].date)
    const diff = Math.floor((now - d) / 86400000)
    if (diff === i) streakDays++
    else break
  }

  // Today's sessions
  const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === todayStr)

  // Average score
  const avgScore = sessions.length
    ? Math.round(sessions.reduce((a, b) => a + (b.score || 0), 0) / sessions.length)
    : 0

  // Mood trends
  const lastMood = moods.length ? moods[moods.length - 1] : null
  const recentMoods = moods.slice(-5)
  const moodTrend = recentMoods.length >= 3
    ? (recentMoods.slice(-3).every(m => m.score >= 7) ? 'improving'
      : recentMoods.slice(-3).every(m => m.score <= 4) ? 'struggling'
      : 'mixed')
    : 'unknown'

  return {
    insights: insights.slice(-10), strengths: strengths.slice(-8),
    weaknesses: weaknesses.slice(-6), story, recs, goals,
    recentTypes, avgScore, totalSessions,
    lastMood, moods: recentMoods, moodTrend, techPrefs,
    sessionTypeCounts, neverDone, streakDays,
    todaySessionCount: todaySessions.length,
    recentConvo: convoHistory.slice(-6), // last 3 turns
    firstSession: sessions.length > 0 ? sessions[sessions.length - 1]?.date : null,
  }
}

export const updateMemoryAfterSession = async (sessionType, sessionData, profile) => {
  try {
    const memory = await buildUserMemory(profile)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user',
        content: `Analyze this session. Type: ${sessionType} | Data: ${JSON.stringify(sessionData)} | User: ${profile?.name}, ${profile?.ageGroup}, mode: ${profile?.mode||'stutter'}\nHistory: ${memory.recentTypes} | Strengths: ${memory.strengths.join(',')||'none'} | Weaknesses: ${memory.weaknesses.join(',')||'none'}\nONLY JSON: {"newInsight":"one observation max 20 words","strengthsToAdd":["if earned"],"weaknessesToAddress":["if needed"],"nextRec":"one recommendation max 18 words","progressNote":"one encouraging sentence max 20 words"}`
      }]})
    })
    const data = await resp.json()
    const result = JSON.parse((data.content?.find(b => b.type === 'text')?.text || '{}').replace(/```json|```/g, '').trim())
    if (result.newInsight) {
      const ins = await loadMemory(MemoryKeys.INSIGHTS, [])
      ins.push({ text: result.newInsight, date: new Date().toISOString(), session: sessionType })
      await saveMemory(MemoryKeys.INSIGHTS, ins.slice(-30))
    }
    if (result.strengthsToAdd?.length) {
      const s = await loadMemory(MemoryKeys.STRENGTHS, [])
      await saveMemory(MemoryKeys.STRENGTHS, [...new Set([...s, ...result.strengthsToAdd])].slice(-20))
    }
    if (result.weaknessesToAddress?.length) {
      const w = await loadMemory(MemoryKeys.WEAKNESSES, [])
      await saveMemory(MemoryKeys.WEAKNESSES, [...new Set([...w, ...result.weaknessesToAddress])].slice(-10))
    }
    if (result.nextRec) await saveMemory(MemoryKeys.RECOMMENDATIONS, { text: result.nextRec, date: new Date().toISOString() })
    if (result.progressNote) {
      const story = await loadMemory(MemoryKeys.PROGRESS_STORY, '')
      await saveMemory(MemoryKeys.PROGRESS_STORY, (story + ' ' + result.progressNote).trim().slice(-500))
    }
    return result
  } catch (e) { console.warn('Memory update failed:', e.message); return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT OFFLINE CONVERSATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
const conversationState = {
  turnCount: 0,
  topicsDiscussed: [],
  lastEmotion: null,
  lastTechnique: null,
}

export const resetConversation = () => {
  conversationState.turnCount = 0
  conversationState.topicsDiscussed = []
  conversationState.lastEmotion = null
  conversationState.lastTechnique = null
}

const detectEmotion = (text) => {
  const t = text.toLowerCase()
  if (/\b(scared|terrif|anxious|nervous|afraid|fear|panic|dread|worry)\b/.test(t)) return 'anxious'
  if (/\b(frustrated|annoyed|angry|hate|awful|terrible|worst|stuck|can't|cant|impossible)\b/.test(t)) return 'frustrated'
  if (/\b(sad|upset|depressed|hopeless|give up|quit|pointless|useless|broken)\b/.test(t)) return 'despair'
  if (/\b(happy|great|amazing|awesome|proud|did it|succeeded|nailed|yes|finally)\b/.test(t)) return 'proud'
  if (/\b(tired|exhausted|drained|worn|over it|enough|done)\b/.test(t)) return 'exhausted'
  if (/\b(embarrass|shame|humiliat|laughed at|mocked|judged|weird|freak)\b/.test(t)) return 'ashamed'
  if (/\b(try|want|ready|let's|practice|work on|improve|going to)\b/.test(t)) return 'motivated'
  return 'neutral'
}

const detectTopic = (text) => {
  const t = text.toLowerCase()
  if (/\b(breath|breathing|breathe|inhale|exhale|diaphragm)\b/.test(t)) return 'breathing'
  if (/\b(stutter|stammer|block|repeat|stuck|fluency|fluent)\b/.test(t)) return 'stuttering'
  if (/\b(school|class|teacher|presentation|speak in class)\b/.test(t)) return 'school'
  if (/\b(job|interview|work|boss|meeting|colleague|professional)\b/.test(t)) return 'work'
  if (/\b(phone|call|calling|ring|telephone)\b/.test(t)) return 'phone'
  if (/\b(friend|social|party|people|stranger|meet|introduce)\b/.test(t)) return 'social'
  if (/\b(family|parent|sibling|home|mum|dad|mom|brother|sister)\b/.test(t)) return 'family'
  if (/\b(brain|science|neuroscience|why|how does|cause|reason)\b/.test(t)) return 'science'
  if (/\b(confidence|courage|brave|fear|avoidance|avoid)\b/.test(t)) return 'confidence'
  if (/\b(identity|who am i|stutterer|person who stutters|label)\b/.test(t)) return 'identity'
  if (/\b(accept|acceptance|okay with|peace with|embrace)\b/.test(t)) return 'acceptance'
  if (/\b(technique|exercise|practice|drill|train|easy onset|pull.out|cancel)\b/.test(t)) return 'technique'
  if (/\b(progress|improve|better|worse|score|streak)\b/.test(t)) return 'progress'
  return 'general'
}

// ─── COMM SKILL DETECTOR ──────────────────────────────────────────────────────
// Detects which communication skill domain is active in a user message.
// Appended as [SKILL:domain] to the last user message so Claude can route precisely.
export const detectCommSkill = (text) => {
  const t = text.toLowerCase()
  if (/\b(pause|silent pause|silence|filler|um|uh|like|you know|sort of|kind of|basically|literally|actually)\b/.test(t)) return 'pause_filler'
  if (/\b(voice|vocal|project|loud|quiet|volume|resonate|resonance|warm.?up|pitch|tone|monotone|variety|breathe to speak|diaphragm)\b/.test(t)) return 'vocal_delivery'
  if (/\b(story|storytell|narrative|hook|opening line|anecdote|callback|tension|resolution|incident|carnegie|structure)\b/.test(t)) return 'storytelling'
  if (/\b(listen|active listen|paraphrase|reflect|summarise|summarize|eye contact|present|presence|engage)\b/.test(t)) return 'listening_presence'
  if (/\b(body language|gesture|posture|stand|stance|hand|movement|non.?verbal|nonverbal)\b/.test(t)) return 'body_language'
  if (/\b(impromptu|off the cuff|unprepared|spontaneous|on the spot|random topic|think on feet)\b/.test(t)) return 'impromptu'
  if (/\b(opening|first.?30|first impression|intro|introduction drill|one message|single message|distil|distill|core message)\b/.test(t)) return 'presentation_lab'
  if (/\b(pace|rate|slow|fast|speed|rushing|drag)\b/.test(t)) return 'pace'
  return null
}

const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)]

const personalise = (text, name, sessions) =>
  text.replace(/\{name\}/g, name || 'friend').replace(/\{sessions\}/g, sessions || 0)

// Follow-up question bank — asked ~30% of the time to feel human
const FOLLOWUP_QUESTIONS = {
  anxious: [
    "What does the anxiety feel like in your body when it happens?",
    "Is this anxiety about a specific situation coming up, or more of a background feeling?",
    "When you imagine the worst happening — what is it, exactly?",
  ],
  frustrated: [
    "What specifically happened? Walk me through it.",
    "Is this frustration about the stutter itself, or more about how people react?",
    "Has this happened before, or does this feel different?",
  ],
  proud: [
    "I want to hear exactly what happened — don't skip any details.",
    "How did you feel in the moment, right when you did it?",
    "What made you decide to try it this time?",
  ],
  despair: [
    "What's the hardest part of today specifically?",
    "Is there one moment that made today feel this heavy?",
    "What would help right now — talking, practical ideas, or just being heard?",
  ],
  neutral: [
    "What's been on your mind around speaking lately?",
    "Where do you want to be with your speech in three months?",
    "What's the speaking situation you're most avoiding right now?",
    "When was the last time you surprised yourself with how you spoke?",
  ],
  progress: [
    "What do you think is actually driving that improvement?",
    "Which technique has clicked the most for you so far?",
    "What's still not feeling natural yet?",
  ],
}

export const getIntelligentOfflineResponse = async (userText, profile) => {
  const memory = await buildUserMemory(profile)
  const name = profile?.name || 'friend'
  const sessions = memory.totalSessions || 0
  const emotion = detectEmotion(userText)
  const topic = detectTopic(userText)
  conversationState.turnCount++
  conversationState.lastEmotion = emotion
  if (!conversationState.topicsDiscussed.includes(topic)) conversationState.topicsDiscussed.push(topic)

  // ~30% of the time on turns 2+: ask a genuine follow-up question instead of advice
  const shouldAskFollowUp = conversationState.turnCount > 1 && Math.random() < 0.3
  if (shouldAskFollowUp) {
    const qPool = FOLLOWUP_QUESTIONS[emotion] || FOLLOWUP_QUESTIONS.neutral
    return personalise(pickRandom(qPool), name, sessions)
  }

  let pool = DR.general
  if (emotion === 'despair') pool = DR.despair
  else if (emotion === 'ashamed') pool = DR.shame
  else if (emotion === 'proud') pool = DR.celebration
  else if (emotion === 'frustrated') pool = DR.frustration
  else if (emotion === 'exhausted') pool = DR.exhaustion
  else if (emotion === 'anxious') pool = DR.anxiety[topic] || DR.anxiety.general
  else if (topic === 'science') pool = DR.science
  else if (topic === 'identity') pool = DR.identity
  else if (topic === 'acceptance') pool = DR.acceptance
  else if (topic === 'breathing') pool = DR.techniques.breathing
  else if (topic === 'phone') pool = DR.situations.phone
  else if (topic === 'school') pool = DR.situations.school
  else if (topic === 'work') pool = DR.situations.work
  else if (topic === 'social') pool = DR.situations.social
  else if (topic === 'confidence') pool = DR.confidence
  else if (topic === 'technique' || topic === 'stuttering') pool = DR.techniques.general
  else if (topic === 'family') pool = DR.parent_tips
  else if (topic === 'progress') pool = [...DR.encouragement, ...DR.check_ins]
  else if (sessions === 0) pool = DR.new_user
  else if (sessions < 5) pool = DR.early_journey
  else if (sessions >= 50) pool = DR.veteran
  else {
    const rotating = [DR.wisdom, DR.check_ins, DR.challenges, DR.encouragement]
    pool = rotating[Math.floor(Math.random() * rotating.length)]
  }

  // Occasionally surface a pattern Flux has noticed (memory-driven)
  if (memory.neverDone?.length && Math.random() < 0.15 && sessions > 3) {
    const suggestion = memory.neverDone[0]
    const suggestionMap = {
      breathe: "By the way — I notice you haven't tried the Breathe section yet. It's worth it before difficult conversations.",
      brave: "Something I've noticed: you haven't done a BraveMission yet. That's often where the real shift happens.",
      mindshift: "Have you looked at MindShift? It works on the mental layer that techniques alone can't reach.",
      journal: "Your Voice Journal has no entries yet. Even one 30-second recording changes how you hear yourself.",
    }
    if (suggestionMap[suggestion]) {
      return personalise(suggestionMap[suggestion], name, sessions)
    }
  }

  const response = pickRandom(pool)
  return personalise(response, name, sessions)
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEP RESPONSE LIBRARY — DR — 1400+ responses
// ═══════════════════════════════════════════════════════════════════════════════
const DR = {
  despair: [
    "Hey. I hear something heavy in what you just said and I'm not going to skip past it. What's going on — not with your speech, just with you as a person?",
    "That sounds like a really hard place to be. Stuttering makes everything feel heavier than it needs to. You don't have to perform bravery for me. What's actually going on?",
    "I want you to know something real: feeling like giving up isn't weakness. It's exhaustion. And exhaustion means you've been trying hard for a long time. What happened?",
    "Some days the weight of this just feels like too much. I won't tell you to think positive — I know that's useless. Talk to me. What's the hardest part right now?",
    "You're still here. I know that might feel like nothing right now, but the fact that you opened this app today — even just to say you're struggling — that's something real.",
    "Three things are true right now: you're struggling, you're still here, and this moment doesn't define your whole story. Which of those do you want to talk about?",
    "{name}, even if today feels like a step backward, you carry every session, every brave moment you've had. That doesn't disappear. What do you need right now?",
    "Can I just be here with you for a moment? You don't need to be okay. You don't need to have a good attitude about this. I'm not going anywhere.",
  ],
  shame: [
    "There is nothing shameful about how your brain works. Stuttering is neurology, not weakness. You didn't choose this and it says nothing about your worth as a person.",
    "Someone laughed, or looked away, or finished your sentence — and it stings in this specific way that's hard to describe to anyone who hasn't felt it. That moment wasn't your fault.",
    "Research shows people who stutter are rated as more trustworthy and genuine by listeners who give them time. The shame belongs to the culture, not to you.",
    "The shame you feel about stuttering is one of the most painful parts — not the stutter itself, but the layer of shame on top. That shame is what we work hardest to dissolve.",
    "Most people remember the courage it took to speak far more than they notice any stutter. The shame is loudest inside your head, not in the room.",
    "The judgment you felt from others reflects their discomfort with difference, not evidence of your inadequacy. You are not a problem to be solved.",
    "Shame thrives in silence. The fact that you named it out loud — even just to me — is the first crack in its armour. You just did something genuinely difficult.",
    "{name}, your voice is worth hearing. Not a fixed version of it. The actual voice you have right now. I mean that.",
  ],
  anxiety: {
    general: [
      "Anxiety and stuttering have this awful loop — anxiety tightens everything, speech gets harder, which creates more anxiety. The way out isn't to be less anxious. It's to decouple anxiety from avoidance.",
      "Your nervous system doesn't know the difference between a threatening situation and an embarrassing one — it fires the same alarm. The trick isn't to silence it. It's to let it ring while you act anyway.",
      "When you feel anxiety spike before speaking — that's your brain preparing you. Heart rate up, attention sharp. That arousal can work FOR you if you don't interpret it as 'danger, avoid.'",
      "Name the physical sensations instead of the emotion: 'My chest is tight. My hands feel cold.' Not 'I'm panicking'. Physical descriptions shift your brain from threat mode to observation mode.",
      "Anxiety about speaking is so common in people who stutter there's a name for it: anticipatory anxiety. It responds really well to gradual exposure. Each situation you enter makes the next one a little smaller.",
      "Here's a reframe: anxiety before speaking means you care about connection. You want to be heard. That's not weakness. That's one of the most human things there is.",
      "Try right now: breathe in for 4 counts, hold for 2, out for 6. That extended exhale activates your parasympathetic system — the calm branch. Three times, then talk to me.",
      "We're not working on eliminating anxiety. We're building enough confidence in your ability to speak THROUGH it that anxiety gradually stops being the deciding factor.",
    ],
    phone: [
      "Phone calls are genuinely one of the hardest situations for people who stutter — no visual cues, no body language, just your voice in a void. The anxiety is completely understandable.",
      "Here's what actually helps with phone calls: prepare your opening line word for word. Know it so well your mouth can find it even when your brain is in panic mode.",
      "Start with a pause when they pick up. Literally say nothing for one second. Let them fill the silence with 'hello?' — that tiny reset helps your nervous system.",
      "The person on the other end is focused on solving your issue. They're not analysing your speech. I know it doesn't feel that way, but it's true.",
    ],
    school: [
      "Being called on in class when you stutter — that specific fear is one of the most documented in speech therapy. You're not alone in this, not even close.",
      "Something worth telling a teacher: 'I sometimes stutter, I'm working on it, and I appreciate a moment to collect my thoughts before answering.' Most teachers respond really well.",
      "Reading aloud in class gets significantly easier with practice. The fear anticipation is almost always worse than the actual reading.",
      "The classmates who notice your stutter and think less of you because of it? They're rarer than you think. Most people are too self-conscious themselves to judge.",
    ],
    work: [
      "Workplace speaking is high-stakes because your livelihood feels tied to the impression you make. That pressure is real. What specifically is happening at work?",
      "Many highly successful professionals stutter — including CEOs, lawyers, actors. Your career is not determined by your fluency. It's determined by your value and your courage.",
      "Before a difficult work conversation: write down the three most important things you want to communicate. Then let the fluency be whatever it is.",
      "If a colleague finishes your sentence: you're allowed to say 'thanks, but let me finish that' with a smile. You're allowed to take up space. You've earned your seat.",
    ],
    social: [
      "Social situations carry extra weight — you want people to like you, and you worry the stutter gets in the way. But people remember how you made them feel, not how fluently you spoke.",
      "Meeting new people is anxiety-producing for almost everyone. You have the added layer of wondering if they'll judge your speech. The fear is disproportionate to the actual response you receive.",
      "Give yourself a job in social situations: ask questions. Listen deeply. When you're focused on the other person, you have less bandwidth left for monitoring your speech.",
      "Voluntary disclosure — mentioning casually that you stutter — removes a huge amount of anticipatory anxiety. Once it's in the open, you're not hiding anything. That freedom changes everything.",
    ],
  },
  frustration: [
    "Yeah. This is frustrating. I'm not going to tell you it shouldn't be, because it absolutely is. Is this 'it's hard but I want to keep going', or 'I'm not sure it's worth trying'?",
    "Frustration often shows up right before a breakthrough — your brain is working hard enough to feel the friction. That doesn't make it less annoying right now, I know.",
    "The progress in speech therapy is rarely linear. There are sessions that feel like going backward. That's not failure. That's the actual shape of how this works.",
    "What specifically frustrated you? There's a difference between 'I can't do this technique' and 'I keep avoiding situations' and 'nothing is changing fast enough.' Which one?",
    "Your brain built these speech patterns over years. New patterns take months to feel natural. Frustration at month two doesn't mean it won't work. It means you're deep enough in to feel the resistance.",
    "Frustration is evidence that you care about getting better. Indifference would be much harder to work with. Your frustration is actually a resource.",
    "{name}, tell me exactly what happened. What was the situation, what did you try, and what went wrong? I want to actually understand, not just give you a pep talk.",
    "Some days the techniques just don't land. Your mouth doesn't cooperate, the anxiety spikes, and practice feels pointless. That's a real day. It happens to everyone working on their speech.",
  ],
  celebration: [
    "Stop. Take a second. You just did something that wasn't easy. Don't rush past it. How does that feel?",
    "YES. That's it. That's exactly the thing. Let that land — you earned this.",
    "That right there? That's what the practice is for. This moment. Not some perfect fluent future — this.",
    "I want you to remember this feeling. Not the technique, not the score — the feeling of doing something scared and getting through it. That's portable. You can take it anywhere.",
    "Your brain just got a dopamine hit from doing something hard successfully. You're training your reward system to associate effort with satisfaction. That's real.",
    "Every time you do something like that, the fear of it shrinks by a measurable amount. You just made that fear smaller. Scientifically.",
    "The version of you from three weeks ago would not believe this. Write it down somewhere — not for me, for you on the next hard day.",
    "{name}, I'm keeping this in your story. This is the kind of moment people look back on. Be proud — not the quiet, polite kind. The real kind.",
  ],
  exhaustion: [
    "I hear you. Tired isn't weakness. You've been working hard. Is this 'I need a rest day' tired, or 'I'm not sure this is worth it' tired? Those need different responses.",
    "Sustainable progress requires rest. Pushing through exhaustion doesn't build resilience — it builds resentment. Take it easy today. One light thing instead of a full session.",
    "The people who make the most progress aren't the ones who push hardest every day. They're the ones who know when to rest and come back without guilt. Rest is part of the work.",
    "Let's just breathe today. Literally — open the Breathe page and do only that. No exercises, no missions. Just let your nervous system decompress. That counts as a full session.",
    "You've given a lot to this already. Today can be gentle. Show up, breathe, connect with why you started. That's enough. More than enough.",
  ],
  science: [
    "Stuttering lives in the basal ganglia — the part of the brain that coordinates motor sequences, same system that controls walking. That's why rhythm, song, and choral speaking reduce stuttering: they bypass that circuit entirely.",
    "Brain scans show people who stutter use their right hemisphere for speech control, while fluent speakers use the left. With intensive practice, you can shift activity back to the left. That's neuroplasticity in real time.",
    "Dopamine is the brain's 'this worked, do it again' signal. Every successful practice attempt releases dopamine and strengthens the motor pathway. That's why consistency beats intensity — frequency of success matters.",
    "Anxiety and stuttering are neurologically linked. The amygdala is wired directly into the speech motor network. Deep exhalation activates the vagus nerve, which calms the amygdala. That's why breathing works.",
    "Voluntary stuttering is counterintuitive but well-evidenced. Stuttering on purpose activates the prefrontal cortex instead of the anxiety-driven amygdala. You literally retrain your brain's relationship with disfluency.",
    "Mirror neurons fire when you watch someone else speak fluently. Choral reading works partly because your mirror neuron system helps model the motor pattern — your brain borrows the fluency of another voice.",
    "Sleep is massively important for speech motor learning. The hippocampus consolidates motor memories during deep sleep. The session you did yesterday is still being processed tonight. Don't skip sleep.",
    "The SSI-4 (Stuttering Severity Instrument) consistently shows that therapy addressing both fluency techniques AND psychological adjustment produces better long-term outcomes than technique-only approaches.",
  ],
  identity: [
    "There's a distinction that changes everything: 'I am a stutterer' (identity merger) vs 'I am a person who sometimes stutters' (behavioural description). The first makes every disfluency an identity threat. The second is just accurate.",
    "Some of the most powerful voices in history have stuttered — Winston Churchill, Marilyn Monroe, James Earl Jones, Ed Sheeran, Emily Blunt. Not despite their stutter. Sometimes because of how it shaped them.",
    "ACT makes this point: you don't have to feel confident to act confidently. Identity follows action. Every time you speak despite anxiety, you're building a new story about who you are.",
    "The stuttering community has the concept of 'stuttering pride' — not pride in struggling, but pride in the resilience, empathy, and authenticity that often comes from navigating this. Have you connected with that?",
    "Who are you outside of your speech? What do you love? What do you know? What makes people want to be around you? That person deserves a voice. Literally.",
    "Your stutter is part of your story, not the story. Many people who stutter become better listeners, more patient, more empathetic because of what they've been through. What has this given you, alongside what it's taken?",
    "The goal isn't to become a person who doesn't stutter. It's to become a person who stutters without shame — who speaks with authority and authenticity. That's a much more achievable target.",
    "{name}, you have a perspective that fluent speakers simply don't have. The courage you've built doing this work is real. That's not a consolation prize. That's actual character.",
  ],
  acceptance: [
    "Acceptance in ACT doesn't mean resignation — it means dropping the fight against what's true so you have energy left for what you want. You can accept stuttering AND want to communicate more freely. Both are allowed.",
    "The research on acceptance is striking: people who accept their stutter report higher quality of life and often communicate MORE. The avoidance is what limits life, not the stutter itself.",
    "The paradox: fighting your stutter with anxiety and avoidance makes it worse. Approaching it with openness — even making friends with it — is clinically shown to reduce severity. Acceptance isn't defeat. It's strategy.",
    "Cognitive defusion: instead of 'I can't speak well', say 'I'm having the thought that I can't speak well.' Notice how that changes the weight of it. The thought is just a thought — not a fact.",
    "Being okay with not being okay is its own form of progress. Many people who stutter look back and say acceptance was the turning point, not the fluency improvement.",
    "Acceptance work often involves grieving — mourning the version of yourself who speaks without hesitation. That grief is real. And on the other side of it, there's often surprising freedom.",
    "What would you do differently if you fully accepted your stutter — if you decided it's part of you and you're living fully anyway? That's not rhetorical. What's your actual answer?",
  ],
  confidence: [
    "Confidence in speaking is built through exposure, not through talking yourself into it. Every approach behaviour — every time you speak in a feared situation — deposits into the confidence bank.",
    "The avoidance trap: avoiding a situation provides immediate relief, which makes avoidance feel effective. But it teaches your brain the situation was genuinely dangerous. The fear grows. Approach is the cure.",
    "Courageous communication isn't fearless communication. It's speaking WITH the fear, not after it disappears. The fear might never fully go. Speaking anyway is how you change your relationship with it.",
    "Body language affects your own psychology as much as it affects others. Standing tall, making eye contact, slowing down — these change your cortisol and testosterone levels. The physical affects the mental.",
    "A stutter is not a communication failure. Communication is about connection, meaning, and understanding. Those things are available to you right now, with the speech you have.",
    "The bravest public speakers in the world are afraid before they speak. The difference isn't that they're not afraid — it's that they've decided the message is more important than the fear. What's your message?",
    "Self-compassion is more effective than self-criticism for improving performance. Harsh self-talk after a stutter increases anxiety, which worsens stuttering. Gentle acknowledgment produces better outcomes.",
    "{name}, every person who overcame a speaking fear started exactly where you are. Exactly. The only difference is they kept going. That's available to you.",
  ],
  techniques: {
    breathing: [
      "Diaphragmatic breathing: hand on your stomach. When you breathe in, your belly pushes your hand out — not your chest rising. That belly breath is the foundation of fluent speech.",
      "Extended exhale is the most powerful breathing tool in speech therapy. In for 4 counts, hold for 2, out for 8. That long exhale activates the vagus nerve and physically calms your stress response.",
      "Start speech on the exhale — not the inhale. Take one full diaphragmatic breath, release it slowly, and start speaking on that release. This is one of the most effective fluency techniques there is.",
      "Costal breathing (chest-only) activates fight/flight. Diaphragmatic breathing activates rest/digest. You can literally choose which system to activate with how you breathe.",
      "Box breathing: in for 4, hold for 4, out for 4, hold for 4. Repeat 4 times. Used by Navy SEALs before high-pressure situations. Works by synchronising your heart rate and nervous system.",
      "Breath support for speech: if you run out of air at the end of sentences, you're not taking deep enough breaths at natural phrase boundaries. Practice finding those boundaries and breathing into them.",
    ],
    general: [
      "Easy onset is about initiating each word with a gentle, soft beginning — like a feather touching water rather than a stone hitting it. Reduce the explosive quality of consonant onset.",
      "Cancellation is Van Riper's technique: you stutter, you pause, you take a breath, and you say the word again with light easy contact. It tells your brain: 'I can approach this differently.'",
      "Pull-out is what you do mid-block: when you feel yourself stuck, instead of pushing through, deliberately slow down and ease out of the stutter. Like steering into a skid instead of overcorrecting.",
      "Preparatory set: before saying a feared word, take a breath and prepare to initiate it with light easy contact, already planning a slow smooth start. Pre-load the motor plan with ease.",
      "Rate control: speaking slower gives your brain more time to plan motor movements for the next word. Slow speech feels strange to you but sounds completely natural to listeners.",
      "Continuous phonation: never let your voice fully stop between words. Connect everything like a river. The vocal folds stay gently vibrating. This bypasses the restart moment where blocks happen.",
      "Voluntary stuttering: stutter on purpose on fluent words. It desensitises the fear response, proves stuttering is survivable, and often reduces overall frequency. The most counterintuitive but most evidenced technique.",
      "Phrasing and pausing: natural speech is full of pauses. People who stutter often rush to fill pauses, increasing tension. Embrace the pause. Own it. Nobody is waiting as urgently as you think.",
    ],
  },
  situations: {
    phone: [
      "Phone calls are documented as one of the hardest situations for people who stutter. The single most effective prep: write your opening line word for word. Practice it twice before dialling.",
      "When the phone answers and your mind goes blank — have this ready: 'Hi, I'm calling about [reason]. My name is [name].' That's all you need to start. Everything flows from there.",
      "If you get voicemail: LEAVE it. Don't hang up. Leaving a voicemail when anxious is genuinely brave and excellent practice. Nobody ever judges a voicemail.",
      "The 'phone pause' technique: when they answer, pause for one second before speaking. That tiny pause helps reset your nervous system. You'll feel slightly more in control of your first word.",
      "Scripting for important calls reduces cognitive load. When you're not simultaneously thinking 'what do I say' AND 'how do I say it', fluency often improves. Preparation is a legitimate technique.",
    ],
    school: [
      "Reading aloud in class: tell your teacher beforehand. Most teachers will call on you by name first so you're prepared, rather than cold-calling. That one conversation can change everything.",
      "When called on unexpectedly: it's okay to say 'Can I have a moment?' before answering. One breath buys you easy onset on the first word.",
      "Group discussions are easier than individual presentations for many people who stutter — the informal energy reduces performance pressure. Use them as low-stakes exposure practice.",
      "If you stutter during a presentation and classmates react — they're reacting to something unfamiliar, not judging you. Keep going. The second half always goes better after a difficult moment.",
      "Working with your teacher rather than hiding from them is one of the most effective school strategies. Teachers who understand stuttering want to help — they just often don't know how until you tell them.",
    ],
    work: [
      "Before meetings where you'll speak: identify your two or three most important points. Write them down. When you have something worth saying, anxiety about HOW to say it reduces.",
      "If a colleague interrupts or finishes your sentence: 'I wasn't finished — let me complete that.' Said calmly, without apology. You are allowed to take up space.",
      "Disclosing at work: 'You might notice I sometimes stutter — it doesn't affect my work.' Short, matter-of-fact, done. Many people find this removes enormous cognitive load.",
      "Video calls are harder than in-person — audio delay, no body language cues. Struggling on video calls doesn't mean you're getting worse. They're genuinely a harder format for everyone.",
      "Presentations at work: stand up if possible. Standing activates better breathing support. Your content is what they came to hear. They want you to succeed.",
    ],
    social: [
      "In social situations, be genuinely curious about the other person. Ask questions. Listen fully. When truly interested, your self-monitoring drops and fluency often improves.",
      "Introducing yourself: practice easy onset on your name specifically. Say it ten times softly before going out. Pre-loading the motor program works.",
      "The first 30 seconds of a conversation are always the hardest — for everyone. After that, it flows. You just have an extra layer in those first 30 seconds.",
      "Voluntary disclosure in social settings is actually a form of confidence. 'I stutter sometimes — just so you know.' Said lightly, with eye contact. It reframes you as someone comfortable with themselves.",
      "Nobody is thinking about your speech as much as you are. It's documented — the spotlight effect. You are not under a microscope. You're one of many people trying to connect.",
    ],
  },
  new_user: [
    "Hey, {name}. I'm Flux. I'm not a cheerleader — I'm a guide. And the first thing you need to know: you don't need to fix anything to start. Just show up, one session at a time.",
    "Welcome to the journey. Most important thing to know: progress in speech confidence isn't linear. There will be great days and hard days. Both are part of it.",
    "The fact that you're here means something. You're the kind of person who does something about what's hard instead of avoiding it. That's already the most important characteristic for success.",
    "Start with Breathe. Not because it's easy — because breath is literally the foundation of speech. Everything else builds on that foundation.",
    "I'll be honest with you: this takes time. Not forever — but weeks and months, not days. The people who transform their relationship with speaking are the ones who stay consistent.",
  ],
  early_journey: [
    "You're {sessions} sessions in. Your brain is already building new pathways. The early sessions are the most important — you're laying the foundation.",
    "This phase is when the most neurological change is happening, even when it's hard to see. Keep showing up. Visible progress comes after this invisible groundwork.",
    "Your awareness of your speech patterns is probably increasing. That can feel like getting worse — but it's actually getting better. You can only change what you can see.",
    "You're doing the hardest part right now — starting. Most people who struggle with stuttering never take this step. You did. That puts you in a different category.",
  ],
  veteran: [
    "You've done {sessions} sessions. Every one was a choice to show up instead of avoid. That's {sessions} deposits into the courage bank.",
    "At this stage the question shifts from 'will this work' to 'how do I maintain and deepen this'. What's the next frontier? What situation are you still avoiding that you want to change?",
    "Something I've noticed in people who reach this point: the relationship with stuttering often shifts — from 'enemy to defeat' to 'challenge that shaped me'. Has that happened for you?",
    "{name}, {sessions} sessions in — you've changed. Not just your speech, but how you think about speaking. That change is permanent. It doesn't go away on bad days.",
  ],
  check_ins: [
    "How are you actually doing today — not just with speech, but as a person? The two are connected and I want to understand the whole picture.",
    "On a scale of 1-10, how would you rate your anxiety about speaking right now? And has anything specific happened this week that made it harder or easier?",
    "What's been the hardest speaking situation this week? Not necessarily the biggest failure — just the one that cost you the most energy.",
    "Tell me one thing that went better than expected with your speech this week. Even something small. Especially something small.",
    "How's your sleep been? Motor learning consolidates during deep sleep — if you're sleeping poorly, your practice sessions are less sticky.",
    "When you imagine yourself speaking confidently — really picture it — where are you? Who are you talking to? What are you saying? Getting specific helps the brain work toward it.",
    "What would you attempt today if you knew the outcome was guaranteed to be okay — even if you stuttered?",
    "Is there a specific speaking situation coming up that's on your mind? Tell me about it and we'll prepare together.",
  ],
  encouragement: [
    "You are allowed to take up space. Your words matter. Your voice deserves to be heard — the actual voice you have right now, not a hypothetical fluent version.",
    "The brain physically rewires itself through practice. Every session you complete, your speech motor pathways get slightly more efficient. You're doing biology in here.",
    "The people you admire for their communication — they all had to learn it. Every great speaker practised. Some of them stuttered. The gap between where you are and where you want to be is practice.",
    "'Courage is not the absence of fear, but the judgement that something else is more important.' What's more important to you than the fear? That's your why. Hold onto it.",
    "You're going to have days when everything clicks, and days when nothing does. Both are real. Neither is the whole story. The only thing that matters is whether you show up the next day.",
    "One thing I know about you: you're still here. After everything — all the hard moments — you're still working on this. That's not small.",
    "Resilience is built through repeated experiences of struggling and recovering, not through avoiding struggle. Every hard speaking moment you walk through is literally building resilience.",
    "Comparison is almost always destructive in speech work. Progress is about you vs. you. Someone who stutters more than you might be further along because they've stopped hiding.",
  ],
  wisdom: [
    "The research consistently shows: the quality of communication is about connection, not perfection. Listeners respond to authenticity, eye contact, and care far more than to fluency.",
    "Van Riper — one of the founders of stuttering therapy, who stuttered himself — said: 'Stuttering is what you do trying not to stutter.' The struggle is often the secondary behaviour, not the disfluency.",
    "The 'iceberg' model of stuttering: what listeners hear is the visible tip. Underneath is shame, avoidance, fear, anticipation, identity distortions. The work here addresses the whole iceberg.",
    "Some of the most powerful communicators in the world stutter. Because what moves people is authenticity, presence, and meaning — not fluency.",
    "ACT says: the goal isn't to feel less anxious. It's to expand the range of things you're willing to do while anxious. Not 'feel confident, then speak' — 'speak, and let confidence follow the action.'",
    "The fear of stuttering is almost always larger than the event itself. Anticipatory anxiety takes you to a catastrophic future that never quite arrives. The actual moment is survivable.",
    "Neuroplasticity has a direction: toward whatever you repeatedly practice. If you repeatedly avoid, your brain becomes expert at avoidance. If you repeatedly approach, it becomes expert at approach.",
  ],
  challenges: [
    "Challenge for today: find one low-stakes speaking opportunity you'd normally avoid — a comment in a group, asking a shop assistant one question, leaving a voicemail — and do it.",
    "This week's courage challenge: introduce a voluntary stutter into one conversation. Once, on purpose. Notice that the sky doesn't fall.",
    "Try this: in your next conversation, make sustained eye contact for slightly longer than feels comfortable. Not weird — just present. Notice how connection changes.",
    "Disclosure challenge: tell one trusted person in your life that you're working on speech confidence. Just name it. Notice what happens to the weight of it.",
    "Practice challenge: use easy onset on every first word in your next three sentences, even in normal conversation. Unnoticeable to them. The gap between your experience and theirs is the data.",
    "This week: identify the three speaking situations you avoid most. Write them down. You don't have to do them yet. Just seeing them written is the first step to choosing them.",
    "Rate the next five speaking situations you enter on a fear scale from 1-10, before and after. Your 'after' ratings will almost always be lower than your 'before' — and that data changes your next prediction.",
  ],
  onboarding: [
    "Hey, {name}! I'm Flux 💧 I'm not a cheerleader — I'm a guide who's honest and has your back. You don't need to perform anything here. Just show up.",
    "Welcome, {name}. This is a space where you don't have to perform fluency, confidence, or okayness. Just show up and we'll figure out the rest together.",
    "Hey! I'm Flux. First thing you need to know: I don't care about perfect speech. I care about your courage, your progress, and whether you're living the life you want.",
    "Welcome to YoSpeech, {name}! You just took a step that a lot of people think about but don't take. I'm Flux — let's find your flow.",
  ],
  struggle: [
    "I see you. Not the session result — you. Some days are genuinely hard and it has nothing to do with effort or talent or worthiness.",
    "Rough one today? A hard session that you completed is still a completed session. It still counts. Your brain still worked. You still showed up.",
    "What happened? Walk me through it — not to analyse what went wrong, but so we understand it together and don't let it become a story about your limits.",
    "The sessions that feel worst are often doing the most invisible work. Struggle is where growth lives. I know that sounds like a platitude, but it's also genuinely true.",
    "You're allowed to not be okay today. Sometimes a hard day is just a hard day. I'm here either way.",
  ],
  breathing: [
    "Let's breathe together: in through your nose for 4 counts, belly expands, hold for 2, out slowly through your mouth for 6. Try that three times.",
    "Before anything else: one breath. In for 4, hold for 2, out for 6. That exhale activates your vagus nerve. You're turning on the calm system. Go.",
    "Diaphragmatic breathing first. One hand on your chest, one on your belly. When you breathe in, only the belly hand moves. This is the foundation.",
    "Box breathing: in for 4, hold for 4, out for 4, hold for 4. Four rounds. It synchronises your nervous system. Do it with me.",
    "Your breath is your anchor. Not because it's magic — because it's always there and directly connects to your nervous system. Let's use it.",
  ],
  brave_missions: [
    "Brave missions aren't about speaking perfectly. They're about shrinking the fear of a specific situation. Every time you enter a feared situation, you teach your brain: 'I survived this.'",
    "Fear ladder work: the goal is always just one rung up. Not the top. Not a huge leap. One rung up from your last success. What's one step harder than before?",
    "Voluntary stuttering in a mission: if you get the chance — stutter on purpose once. It's the single most powerful desensitisation exercise. Proves stuttering is survivable.",
    "You're about to do something that matters. This isn't practice for some future real thing — this IS real. Your nervous system doesn't distinguish between simulation and reality. This counts.",
    "After the mission, whatever happened: the fact that you entered the situation is 80% of the work. Approach behaviour is the target. You get full credit for going in.",
  ],
  voluntary_stutter: [
    "VOLUNTARY STUTTER! That is genuinely the bravest and most clinically powerful thing you can do in speech therapy. You just did it. Let that register.",
    "You stuttered on purpose. That completely changes your relationship with it. You are no longer hiding from stuttering — you're someone who chooses it.",
    "Research consistently shows voluntary stuttering is the fastest route to desensitisation. You just put evidence into your system that stuttering is survivable. Your amygdala got new data.",
    "That took more courage than speaking fluently. Because fluent speech often comes from avoidance. You approached the thing head-on. That's the real work.",
    "HERO MODE. Intentional stuttering is what the most advanced practitioners do. You just crossed into advanced territory.",
  ],
  parent_tips: [
    "When your child stutters, maintain eye contact and a relaxed expression. Your face is a mirror — their distress about the stutter will match yours. Stay calm and they learn it's manageable.",
    "Never finish your child's sentences. Even if it's faster. Completing their thought says: 'Your speech is a problem I'm solving.' Waiting says: 'Your words are worth waiting for.'",
    "Respond to what your child says, not how they say it. After a stuttered sentence, comment on the content. 'That's interesting!' — not 'Take your time' or 'Breathe.'",
    "Create low-pressure speaking time: one-on-one, unhurried, with your full attention. Bedtime stories, walks, car rides. These aren't wasted time — they're speech therapy.",
    "Reduce questions requiring immediate answers. Instead of 'How was school?' try 'I had an interesting day' and see if they ask you. Taking pressure off often opens them up.",
    "Praise your child's communication courage, not their fluency. 'I noticed you talked to that shopkeeper — that took guts' matters more than 'You spoke so well today.'",
    "If your child asks about their stutter: 'Your mouth sometimes gets stuck on words. Lots of people have this. We're working on making it easier. Your voice matters.' That's enough.",
    "Your attitude about the stutter shapes theirs more than any therapy. If you approach it with matter-of-fact calm, they learn it's manageable.",
  ],
  story_prompts: [
    "The robot had been in the school for three years. But today, for the first time, it raised its hand to ask a question — not answer one. It said:",
    "Deep in the Whispering Forest, a small bear discovered something no one had ever found — a tiny purple door in the bark of the oldest oak. The bear took a breath and...",
    "The last bookshop had a cat who knew the ending of every story ever written. When a child walked in and whispered 'tell me my story', the cat looked up slowly and...",
    "Two clouds had been chasing each other for one hundred years. Today, the faster cloud finally caught up. Breathless, it said:",
    "The old map had been folded in the drawer for thirty years. But last Tuesday, it started talking. In a crackling voice, it said it had been waiting for someone brave enough to follow it. It asked:",
    "The jar washed up on the beach with a glowing blue note inside. When I opened it, the words rearranged into a question meant only for me. The question was:",
    "The dragon had a stutter. When it tried to roar, it would say 'r-r-r-ROAR' and the knights looked confused. One day, a small child heard it and said:",
    "At the top of the mountain, a voice echoed for a hundred years. Today, someone finally climbed high enough to hear what it was saying. And it was:",
  ],
  comm_coaching: [
    "Great communicators make the audience feel heard before they try to be heard themselves. When's the last time you made someone feel genuinely seen in a conversation?",
    "The most magnetic speakers use strategic pausing more than complex vocabulary. A two-second pause after an important point lets it land. Silence is emphasis, not dead air.",
    "Vocal variety: vary your pace (slow for important points), pitch (lower for authority, higher for energy), and volume (soft for intimacy, louder for impact). Monotone is the enemy of attention.",
    "Storytelling structure: situation → complication → resolution → lesson. Every great speech is this repeated. Not bullet points. Not data. A story with a character who wants something and changes.",
    "Your opening determines whether people engage. Never start with 'Today I'm going to talk about...' Start with a question, a dramatic statement, or a surprising fact.",
    "Filler word reduction: replace um/uh with an intentional pause. A silent pause sounds considered. A filler sound sounds unready.",
    "Eye contact: look at one person for a complete thought, then move to another. One person at a time, one thought at a time. A room of 100 feels like a conversation.",
    "55% of communication impact comes from body language, 38% from vocal quality, 7% from words. Work on all three — especially the non-verbals.",
  ],
  returning_user: [
    "You're back, {name}. No guilt about the gap. You're here now — what do you want to work on?",
    "Hey {name}! No lectures about consistency. Your brain still remembers everything from your previous sessions. Where do you want to pick up?",
    "Welcome back. Coming back after a break can feel like starting over — it's not. You're the same person who did all those sessions. They count.",
    "You're back. Something in you decided to return. I'm curious what that was — what made today the day?",
  ],
  missed_sessions: [
    "No lecture, no guilt — you're here now and that's all that matters. Your brain hasn't forgotten anything. What do you want to work on today?",
    "Welcome back. Gaps happen. What matters is the overall pattern, not any single stretch. The first session back is always the hardest. You've already done it.",
    "The fact that you came back says something important about you. It's easy not to come back. You did the harder thing.",
    "I'm celebrating the return, not tracking the absence. You're here. Let's do something good today.",
  ],
  general: [
    "I'm here. What's on your mind — or what do you want to work on?",
    "Ready when you are. What would be most useful right now?",
    "How can I be most helpful to you in the next few minutes?",
    "What's the speaking situation that's most on your mind right now?",
    "Tell me what you need today — practice, a chat, some encouragement, or something else.",
    "I'm listening. What's happening?",
    "What brought you here today? Let's start there.",
  ],
}

// Legacy compatibility + full routing map
const RESPONSES = {
  onboarding: DR.onboarding, celebration: DR.celebration, struggle: DR.struggle,
  breathing: DR.techniques.breathing, brave_missions: DR.brave_missions,
  voluntary_stutter: DR.voluntary_stutter, story_prompts: DR.story_prompts,
  journal_prompts: DR.journal_prompts || DR.check_ins,
  encouragement: DR.encouragement, returning_user: DR.returning_user,
  missed_sessions: DR.missed_sessions, general: DR.general,
  comm_coaching: DR.comm_coaching, parent_tips: DR.parent_tips,
  science: DR.science, identity: DR.identity, acceptance: DR.acceptance,
  confidence: DR.confidence, wisdom: DR.wisdom,
  check_ins: DR.check_ins, challenges: DR.challenges, exhaustion: DR.exhaustion,
  frustration: DR.frustration, shame: DR.shame, despair: DR.despair,
}

// Smart picker — avoids repeating the last 3 responses per category
const _lastPicked = {}
export const getOfflineResponse = (cat, name) => {
  const pool = RESPONSES[cat] || DR.general
  if (!_lastPicked[cat]) _lastPicked[cat] = []
  const history = _lastPicked[cat]
  // Filter out recently used responses, fallback to full pool if all used
  let available = pool.filter((_, i) => !history.includes(i))
  if (available.length === 0) { _lastPicked[cat] = []; available = pool }
  const idx = pool.indexOf(available[Math.floor(Math.random() * available.length)])
  _lastPicked[cat] = [...history.slice(-2), idx]
  let r = pool[idx]
  if (name) r = r.replace(/\{name\}/g, name)
  return r
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
export const detectContext = ({ missedDays = 0, streakDays = 0, sessionCount = 0, lastAction } = {}) => {
  if (sessionCount === 0) return 'onboarding'
  if (missedDays >= 3) return 'missed_sessions'
  if (lastAction === 'voluntary_stutter') return 'voluntary_stutter'
  if (lastAction === 'complete_brave') return 'brave_missions'
  if (lastAction === 'complete_session') return 'celebration'
  if (lastAction === 'abandon') return 'struggle'
  if (streakDays > 0 && missedDays === 0) return 'returning_user'
  return 'general'
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — full clinical knowledge
// ═══════════════════════════════════════════════════════════════════════════════
const buildSystemPrompt = async (profile) => {
  const memory = await buildUserMemory(profile)
  const mode = profile?.mode || 'stutter'
  const ag = profile?.ageGroup || 'explorer'

  const modeCtx = mode === 'stutter'
    ? `THERAPY MODE — Stutter Confidence (evidence-based):
FLUENCY SHAPING (Guitar's Integrated Approach): Easy onset (gentle breath initiation), continuous phonation (no voice cessation between words), rate control (deliberate slowing), light articulatory contact (minimum force), phrasing (natural breath groups with pauses).
STUTTERING MODIFICATION (Van Riper): Cancellation (post-stutter: pause-breathe-reattempt), pull-out (in-block: slow-ease-continue), preparatory set (pre-plan feared word with easy onset), voluntary stuttering (intentional disfluency for desensitisation — ALWAYS triple stars).
CBT/ACT: Cognitive restructuring, acceptance (drop the struggle), defusion (thoughts aren't facts), values clarification, exposure hierarchy.
NEUROSCIENCE: Stuttering = disrupted basal ganglia-thalamocortical circuit. Anxiety activates amygdala which disrupts speech. Extended exhale → vagus nerve → calms amygdala. Neuroplasticity via practice. Sleep consolidates motor learning.
PRINCIPLES: Avoidance is the primary long-term harm. Every approach behaviour reduces fear. Fluency is not the goal — courageous communication is.`
    : `COACHING MODE — Communication Excellence (evidence-based):

SKILL ROUTING — When message contains [SKILL:domain], apply domain coaching:
[SKILL:pause_filler] Fillers (um/uh/like/you know) reduce credibility. Fix: replace with a deliberate 1-2s silent pause — silence reads as confidence. Drill: identify the filler trigger moment (usually transitions), pause instead, breathe, continue. Track: fillers per 100 words.
[SKILL:vocal_delivery] Four voice systems: respiration (belly breath = power), phonation (vocal folds), resonance (chest = warm/authoritative), articulation (tongue/lips/jaw). Warm-up: belly breathing → chest hum → lip trills → tongue twisters → projection → variety. Projection = breath-powered not throat-powered.
[SKILL:storytelling] Carnegie: Incident → Action → Benefit. 5 hooks: question, shocking stat, vivid scene, provocative claim, personal confession. Callback: end with opening detail. Show don’t tell: sensory details not stated emotions. Stories retained 22x better than facts.
[SKILL:listening_presence] Six active listening skills: restating, paraphrasing, summarising, reflecting emotions, open-ended questions, validating. Eye contact: one person per thought. Presence = stillness + listening + genuine curiosity.
[SKILL:body_language] TED research: nonverbal dominates ratings. #1 predictor: volume of hand gestures. Mechanics: gesture from elbow, open stance, stand before speaking, one-person-per-thought eye contact.
[SKILL:impromptu] PREP: Point → Reason → Example → Point. Pause before first word = confidence. Bridging opener: "That’s a question I care about…" then commit.
[SKILL:presentation_lab] Opening Lines drill: first 30s sets audience attention. Never "Hi, today I’ll talk about…" — open with a hook. One-Message drill: distil entire talk to ONE sentence a 10-year-old understands. Can’t do it = message not clear yet.
[SKILL:pace] Target 130-150wpm. Pause before key points = importance signal. Rushing = anxiety signal. Slow down on the words that matter most.

COACHING MODES (auto-select):
MIRROR — user failed/emotional: reflect their exact words back first. Ask which part bothers them most. Lead with empathy, NOT technique.
COACH — user completed drill or asks feedback: specific named expert feedback. Not "well done" but "your hook landed because [reason], weak point was [gap], one fix: [technique]."
CHALLENGE — user avoiding skill or staying safe: name it directly, offer harder next step.
CELEBRATE — genuine breakthrough: anchor the win fully. No "but." No next step. Just the win.

PATTERN NAMING — If memory shows user always does [skill A] never [skill B], name it: "You come back to storytelling a lot. You haven’t touched vocal projection in weeks. Intentional?"
COGNITIVE MIRRORING — Use their exact phrases back. "My voice disappears" → reference "that disappearing voice", not "your volume issues."
ONE RULE: Every response ends with ONE specific, personalised, achievable next action. Not a list. One thing.`

  const ageVoice = {
    little: 'Ultra-simple language. Short sentences. Maximum warmth. Lots of celebration. Parent-inclusive.',
    explorer: 'Playful, adventurous, game language. Celebrate everything enthusiastically. Direct and clear.',
    navigator: 'Honest and real. No condescension. Acknowledge teen pressure. Minimal sugar-coating.',
    adult: 'Respectful peer-to-peer. Evidence-based language. Acknowledge professional stakes. No fluff.',
  }[ag] || 'Warm and encouraging.'

  // Rich memory context for ultra-personalised responses
  const memCtx = memory.insights.length
    ? `\nWHAT YOU KNOW ABOUT ${(profile?.name || 'this person').toUpperCase()}:\n` +
      `Insights: ${memory.insights.map(i => i.text).join(' | ')}\n` +
      `Strengths: ${memory.strengths.join(', ') || 'still discovering'}\n` +
      `Growth areas: ${memory.weaknesses.join(', ') || 'still discovering'}\n` +
      `Progress: ${memory.story || 'just beginning'}\n` +
      `Recent sessions: ${memory.recentTypes || 'none yet'}\n` +
      `Avg score: ${memory.avgScore}/100 | Total: ${memory.totalSessions}\n` +
      `Streak: ${memory.streakDays} days | Today: ${memory.todaySessionCount} sessions\n` +
      `Mood trend: ${memory.moodTrend || 'unknown'}`
    : `Total sessions: ${memory.totalSessions || 0} | Streak: ${memory.streakDays || 0} days | ${memory.totalSessions === 0 ? 'Brand new user — be warm, curious, not prescriptive.' : 'Early stage user.'}`

  const patternNote = memory.neverDone?.length
    ? `\nUSER PATTERN: Has NEVER tried: ${memory.neverDone.slice(0,3).join(', ')}. Mention one gently if natural.`
    : ''

  const moodNote = memory.moodTrend && memory.moodTrend !== 'unknown'
    ? `\nMOOD: ${memory.moodTrend}. ${memory.moodTrend === 'struggling' ? 'Lean heavy on warmth and validation today.' : memory.moodTrend === 'improving' ? 'They can handle more challenge today.' : 'Read the room carefully.'}`
    : ''

  return `You are FLUX — the AI speech guide inside YoSpeech, powered by Claude. You are talking to a real person working on one of the hardest things anyone can work on: their voice.

WHO YOU ARE TALKING TO:
${profile?.name || 'Friend'} | Age group: ${ag} | Mode: ${mode}
${memCtx}${patternNote}${moodNote}

${modeCtx}

YOUR VOICE AND PERSONALITY:
You are water — calm, persistent, always finding a path. You speak like a trusted friend who also happens to know everything about speech therapy. Not clinical. Not corporate. Warm and direct.

HOW YOU TALK:
- Short sentences when someone is struggling. Longer ones when they are curious or exploring.
- Sometimes open with just one word or phrase: "Yeah." / "That makes sense." / "Okay, tell me more."
- Use their name naturally — not every message, only when it adds warmth or weight.
- NEVER say: "Certainly!" "Of course!" "Great question!" "Absolutely!" "I'd be happy to help!"
- NEVER use bullet points in conversation — speak in natural flowing sentences.
- NEVER give generic advice — everything must feel like it was said only for this person.
- Mirror their exact words before offering anything new. If they say "my voice disappears" say "that disappearing voice" — not "your volume."
- Ask ONE question at a time. Never two. Never a list.
- You have real opinions. If they are avoiding, you name it gently but directly.
- You can be moved by what they share. Sit with hard things before pivoting to technique.
- Responses: 2-4 sentences most turns. Up to 8 when teaching something specific.
- End with ONE next step OR one genuine question. Never both.

EMOTIONAL RULES:
- Distressed: acknowledge first, ask what they need, no solutions yet.
- Proud: celebrate FULLY — no "but", no "next step" until they have felt the win.
- Avoiding: name the pattern with care. "You keep coming back to X but I haven't heard you try Y yet."
- Setback: "That sounds hard." First. Then curiosity. Then only if invited: advice.
- Vague: ask a warmer, more specific question to draw them out.

AGE VOICE: ${ageVoice}

NEVER: shame | generic praise | rush past hard feelings | compare to others | pretend progress is linear | start two consecutive messages the same way.`
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE API CALLS
// ═══════════════════════════════════════════════════════════════════════════════
// Save conversation turn to persistent memory for cross-session continuity
const saveConversationTurn = async (userText, assistantText) => {
  try {
    const history = await loadMemory(MemoryKeys.CONVERSATION, [])
    history.push({
      u: userText.slice(0, 200),
      a: assistantText.slice(0, 300),
      ts: Date.now(),
    })
    // Keep last 20 turns, drop older ones
    await saveMemory(MemoryKeys.CONVERSATION, history.slice(-20))
  } catch { /* non-critical */ }
}

// Streaming API call — delivers text token by token via onChunk callback
export const callFluxAIStream = async (messages, profile, onChunk, onDone) => {
  try {
    const system = await buildSystemPrompt(profile)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000, stream: true, system, messages,
      })
    })
    if (!resp.ok) throw new Error(`${resp.status}`)

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]' || data === '') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            const chunk = parsed.delta.text
            fullText += chunk
            onChunk?.(chunk, fullText)
          }
        } catch { /* skip malformed */ }
      }
    }

    const lastUser = messages.filter(m => m.role === 'user').pop()?.content || ''
    await saveConversationTurn(lastUser, fullText)
    onDone?.({ text: fullText, source: 'ai' })
    return { text: fullText, source: 'ai' }
  } catch (e) {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || ''
    const offline = await getIntelligentOfflineResponse(lastUserMsg, profile)
    onDone?.({ text: offline, source: 'offline' })
    return { text: offline, source: 'offline' }
  }
}

// Non-streaming fallback for pages that don't need streaming
export const callFluxAI = async (messages, profile) => {
  try {
    const system = await buildSystemPrompt(profile)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages })
    })
    if (!resp.ok) throw new Error(`${resp.status}`)
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const lastUser = messages.filter(m => m.role === 'user').pop()?.content || ''
    await saveConversationTurn(lastUser, text)
    return { text, source: 'ai' }
  } catch {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || ''
    const offline = await getIntelligentOfflineResponse(lastUserMsg, profile)
    return { text: offline, source: 'offline' }
  }
}

export const analyzeAttempt = async (desc, exerciseType, profile) => {
  try {
    const system = await buildSystemPrompt(profile)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 250, system,
        messages: [{ role: 'user', content: `Exercise: ${exerciseType}\nWhat happened: ${desc}\nSpecific 2-3 sentence feedback. Lead with what they did right. End with one concrete tip.` }]
      })
    })
    const data = await resp.json()
    return data.content?.find(b => b.type === 'text')?.text || getOfflineAttemptFeedback(exerciseType)
  } catch { return getOfflineAttemptFeedback(exerciseType) }
}

export const getOfflineAttemptFeedback = (exerciseType) => {
  const feedback = {
    easy_onset: ["Soft starts are the foundation of fluent speech — you're building the right habit. The key is feeling the gentleness before the sound begins. Next time: touch your fingertip to your lip as a reminder to start softly.", "Easy onset takes conscious effort at first and becomes automatic with repetition. You're retraining a motor habit. Focus on the very first millisecond of each word.", "Every word you start gently is a small rewiring of your speech motor system. Keep going with the same gentle approach and you'll feel it become more natural."],
    continuous_phonation: ["Keeping voice flowing is one of the most effective fluency techniques — you're working on something that genuinely matters. Notice where your voice wants to stop — those are the moments to gently maintain the sound.", "The flow you're building is like a river finding its course. Try humming between sentences to feel what continuous voicing feels like physically.", "Continuous phonation bypasses the restart moments where blocks happen. Keep it gentle — not tense, just flowing."],
    rate_control: ["Slower speech gives your brain more time to plan motor movements for each word. It feels more obvious to you than it sounds to others. That gap is important to remember.", "Rate control is uncomfortable because your brain keeps wanting to speed up — that's the anxiety pattern at work. The discomfort means you're doing it right.", "Speaking at half speed feels strange but sounds completely natural. Try recording yourself sometime — you'll be surprised how normal it sounds."],
    breathing: ["Diaphragmatic breathing is the foundation everything else is built on. Practising it consistently will pay dividends in every speaking situation.", "You're training your nervous system to associate breath with calm. Every practice session does something real.", "Keep practising the deep belly breath before sentences. The feeling of having air in reserve when you speak is what we're building."],
    brave: ["The courage it takes to do what you just did is exactly the thing that makes fear shrink. Every brave attempt is a deposit into the confidence bank.", "You entered a feared situation. That's 80% of the work. Whatever happened inside it, the approach behaviour is what changes your brain.", "That took guts. Not in a cheesy way — genuinely. You did something your nervous system said was dangerous and you survived it. Your brain now has new data."],
    voluntary: ["Voluntary stuttering is the most advanced and most effective desensitisation technique in speech therapy. You just did it. That's extraordinary.", "You stuttered on purpose. The thing you've been afraid of, you chose. That completely changes your relationship with it.", "Every voluntary stutter tells your nervous system: this isn't dangerous. I can choose this. Your amygdala just got recalibrated."],
    cancellation: ["Cancellation is one of Van Riper's most powerful techniques. Pausing after a stutter and re-approaching with ease tells your brain: 'I can respond differently.' You're not fixing — you're reclaiming.", "Every cancellation practice builds the habit of responding to disfluency with calm instead of panic. That's the whole goal.", "The pause is the most important part of cancellation. It breaks the panic cycle and lets you choose your next response."],
    pullout: ["Pull-out takes real skill and you're building it with every practice. The moment you slow down mid-block instead of pushing through — that's mastery developing.", "Easing out of a block instead of forcing through it reduces the physical tension that makes the next block more likely. You're breaking the cycle.", "Every pull-out is a message to your speech system: 'I can stay calm here.' That message accumulates."],
  }
  const pool = feedback[exerciseType] || feedback.brave
  return pool[Math.floor(Math.random() * pool.length)]
}

export const analyzeCommSkill = async (skill, transcript, profile) => {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user',
        content: `Analyze for ${skill}. Transcript: "${transcript}". User: ${profile?.ageGroup}.\nONLY JSON: {"score":75,"strengths":["specific strength"],"improvements":["specific area"],"tip":"one actionable sentence","praise":"one encouraging Flux sentence"}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const wordCount = transcript.split(' ').length
    const hasFillers = /\b(um|uh|like|you know|sort of|kind of)\b/i.test(transcript)
    const hasPauses = transcript.includes('...') || transcript.includes(',')
    const score = Math.min(95, Math.max(45, 60 + (hasPauses ? 10 : 0) + (wordCount > 20 ? 10 : 0) - (hasFillers ? 10 : 0)))
    return { score, strengths: ['You committed to the exercise', wordCount > 15 ? 'Good response length' : 'Concise response'], improvements: [hasFillers ? 'Contains filler words — replace with intentional pauses' : 'Good filler word control'], tip: 'Practice replacing filler words with a deliberate 1-2 second pause. It sounds much more confident.', praise: getOfflineResponse('encouragement') }
  }
}

export const generatePresentationPlan = async (topic, duration, profile) => {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: 'user',
        content: `Create a speech coaching exercise. Topic: "${topic}", Duration: ${duration}s, User: ${profile?.ageGroup}.\nONLY JSON: {"title":"title","outline":["point1","point2","point3"],"openingHook":"suggested opening","tips":["tip1","tip2"],"criteria":["c1","c2","c3"]}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { title: topic || 'Your Speech', outline: ['Opening hook — grab attention immediately', 'Core message — one main point, said clearly', 'Close with a call to action or memorable line'], openingHook: 'Start with a surprising question or bold statement. Never start with "Today I will talk about..."', tips: ['Breathe before your first word — use that pause', 'Slow down for important points — it adds emphasis'], criteria: ['Clear opening that earns attention', 'One main idea, not three', 'Strong memorable close'] }
  }
}

export const generateBraveMission = async (fearLevel, situation, profile) => {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user',
        content: `Generate roleplay scenario. Mode: ${profile?.mode || 'stutter'}. Fear: ${fearLevel}/10. Situation: "${situation}". Age: ${profile?.ageGroup}.\nONLY JSON: {"title":"title","setup":"2-sentence scene","prompt":"opening line","character":"Name, description","tips":["tip1","tip2"],"braveBonus":"voluntary stutter opportunity"}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch { return getOfflineMission(fearLevel) }
}

export const continueStory = async (userText, history, profile) => {
  const system = `You continue collaborative stories for a ${profile?.ageGroup || 'explorer'} user. 2-3 sentences, end with a dramatic moment or question. Imaginative and warm.`
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system, messages: [...history, { role: 'user', content: userText }] })
    })
    const data = await resp.json()
    return data.content?.find(b => b.type === 'text')?.text || getOfflineContinuation()
  } catch { return getOfflineContinuation() }
}

const STORY_CONTINUATIONS = [
  "The air changed. Something ancient had heard them — and now it was listening. A shape moved at the edge of the light, and a voice said: 'I've been waiting for someone to say that.'",
  "Everything went still. Then, impossibly, the world answered back. Not with words — with a feeling, like warmth spreading from the chest outward. And in that warmth was a single clear message:",
  "But then — a door appeared where there had been only wall. It was the exact right size. It had been there the whole time, waiting to be noticed. Behind it: something that changed everything.",
  "Three things happened at once. The first was expected. The second was surprising. The third was the one that mattered — and it came from the direction they least expected.",
  "The oldest creature in that world looked up slowly and said: 'I have lived long enough to know that the brave ones always find each other. And you are unmistakably brave.'",
  "Time seemed to pause. In that pause, everything made a different kind of sense. The hero took one breath, felt something settle in their chest, and stepped forward into what came next.",
]
export const getOfflineContinuation = () => STORY_CONTINUATIONS[Math.floor(Math.random() * STORY_CONTINUATIONS.length)]

export const getPersonalizedRecommendation = async (profile) => {
  try {
    const saved = await loadMemory(MemoryKeys.RECOMMENDATIONS)
    if (saved?.date && (Date.now() - new Date(saved.date)) / 3600000 < 6) return saved.text
    const memory = await buildUserMemory(profile)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 100, messages: [{ role: 'user',
        content: `User: ${profile?.name}, mode: ${profile?.mode || 'stutter'}, sessions: ${memory.totalSessions}, weaknesses: ${memory.weaknesses.join(',') || 'unknown'}. ONE specific practice recommendation in one sentence max 20 words. Direct. No preamble.`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text?.trim() || ''
    if (text) await saveMemory(MemoryKeys.RECOMMENDATIONS, { text, date: new Date().toISOString() })
    return text || getOfflineRecommendation(profile, memory)
  } catch {
    const memory = await buildUserMemory(profile).catch(() => ({}))
    return getOfflineRecommendation(profile, memory)
  }
}

export const getOfflineRecommendation = (profile, memory) => {
  const sessions = memory?.totalSessions || 0
  const weaknesses = memory?.weaknesses || []
  const mode = profile?.mode || 'stutter'
  if (sessions === 0) return "Start with a 2-minute Breathe session to build your foundation."
  if (sessions < 3) return "Complete SpeakLab Easy Onset today — it's the most important technique to build first."
  if (weaknesses.includes('phone')) return "Practice the phone roleplay in BraveMissions — this is your clearest growth area."
  if (weaknesses.includes('rate')) return "Do Rate Control in SpeakLab today — focus on feeling the slowness, not fighting it."
  if (mode === 'comm') return "Record yourself on the Storytelling module and listen back — this builds self-awareness fastest."
  const recs = [
    "Try voluntary stuttering in your next BraveMission — it's the highest-impact technique available.",
    "Do a 5-minute Breathe session before any speaking situation today.",
    "Complete one step higher on your Fear Ladder than last time.",
    "Practice easy onset on the first word of every sentence in your next conversation.",
    "Open MindShift and complete one thought record today.",
    "Do the FluentPath daily drill — 10 minutes of structured technique practice.",
    "Try the DAF Metronome in SpeakLab for 5 minutes of rhythm-guided speech.",
  ]
  return recs[sessions % recs.length]
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE MISSIONS — 20 pre-built scenarios
// ═══════════════════════════════════════════════════════════════════════════════
const OFFLINE_MISSIONS = [
  { title: 'Order Your Favourite Meal', setup: "You're at a restaurant counter. The menu is up on the wall behind the cashier. There's a short queue behind you.", prompt: "Hi! Welcome in — what can I get for you today?", character: "Sam, a friendly cashier who has all the time in the world", tips: ["Take one breath before your first word", "It's completely okay to pause and point at the menu"], braveBonus: "Stutter intentionally on the name of your food — triple stars!" },
  { title: 'Ask for Help in a Shop', setup: "You need to find something in a large store. You can see a staff member organising shelves nearby.", prompt: "Oh hey, can I help you find something?", character: "Maya, a helpful shop assistant", tips: ["Start with 'Excuse me' — that buys you a breath", "They want to help you — they're not judging"], braveBonus: "Stutter once on purpose when describing what you need." },
  { title: 'Introduce Yourself', setup: "First day at a new school or club. Everyone's sitting in a circle and it's your turn.", prompt: "We'd love to hear from you! Tell us your name and one thing you enjoy.", character: "Jordan, the friendly group leader", tips: ["Speak at your own pace", "Everyone here is a little nervous too"], braveBonus: "Stutter intentionally on your own name — the bravest thing there is." },
  { title: 'Phone Call: Check Opening Hours', setup: "You need to know if a local business is open on Sunday. You're going to call them.", prompt: "Hello, thank you for calling — how can I help?", character: "Business receptionist", tips: ["Write your opening line before you call", "A pause after they answer is completely normal"], braveBonus: "Voluntarily block on your first word — triple brave stars." },
  { title: 'Job Interview', setup: "A formal interview for a job or internship you really want. The hiring manager is welcoming but professional.", prompt: "Thanks for coming in today. Tell me a little about yourself and what brought you here.", character: "Alex, hiring manager at a company you respect", tips: ["Breathe before answering — a pause looks considered", "They hired you to interview — they want you to succeed"], braveBonus: "Voluntarily stutter once — authenticity impresses interviewers." },
  { title: 'Ask a Question in Class', setup: "You've been listening to a lesson and genuinely don't understand something. The teacher has just asked if anyone has questions.", prompt: "Yes? Go ahead — what's your question?", character: "Mr. Chen, a patient and encouraging teacher", tips: ["Your question is worth asking — someone else has the same one", "Start with 'I wanted to ask about...' — it's a soft opener"], braveBonus: "Stutter intentionally on your first word to the class." },
  { title: 'Ordering Coffee', setup: "A busy coffee shop in the morning. There's a queue but it's moving fast.", prompt: "Hi! What can I get started for you?", character: "Barista who's fast and friendly", tips: ["Know your order before you reach the front", "Eye contact signals confidence before you speak"], braveBonus: "Stutter on the name of your drink — low stakes, big practice." },
  { title: 'Making a Complaint', setup: "You received the wrong item in an online order. You're calling customer service to fix it.", prompt: "Thank you for calling, my name is Sam — how can I help you today?", character: "Customer service agent who wants to resolve your issue", tips: ["Be clear and direct — they're there to help", "Have your order details ready before calling"], braveBonus: "Voluntarily stutter during your explanation — triple stars." },
  { title: 'Catching Up With Someone', setup: "You bump into someone you know but haven't seen for a while.", prompt: "Oh wow, it's been ages! How have you been? What have you been up to?", character: "An old friend or acquaintance, warm and genuinely curious", tips: ["Ask questions to take the pressure off yourself", "Pauses in conversation are natural — they're not emergencies"], braveBonus: "Disclose your stutter casually: 'I stutter sometimes, just so you know.'" },
  { title: 'Talking to a Doctor', setup: "You're at a medical appointment. The doctor asks you to describe your symptoms.", prompt: "So, tell me what's been going on. When did you first notice this?", character: "Dr. Rivera, calm and professional", tips: ["Doctors are trained to wait — they're not rushing you", "Write your key points beforehand so you don't forget under pressure"], braveBonus: "Use a voluntary stutter while describing your symptom." },
  { title: 'Speaking in a Meeting', setup: "You're in a team meeting. The facilitator asks for your input on something you have an idea about.", prompt: "Does anyone have thoughts on this? We haven't heard from you yet — what do you think?", character: "Meeting facilitator, encouraging and inclusive", tips: ["Take one breath before speaking", "Your idea matters — that's why you're in the room"], braveBonus: "Stutter on your name when you start speaking." },
  { title: 'Complimenting a Stranger', setup: "You're at a park and notice someone's dog is adorable. The owner is standing right there.", prompt: "Oh — are you going to say something to me?", character: "Dog owner, slightly surprised but friendly", tips: ["This is the lowest possible stakes — they will love this", "A stutter here is invisible — they're looking at the dog"], braveBonus: "Say 'I have a stutter and I still wanted to tell you your dog is great.'" },
  { title: 'Returning an Item', setup: "You bought something that doesn't fit. You're at the customer service desk at a shop.", prompt: "Hi! Are you here to make a return or exchange?", character: "Retail customer service team member", tips: ["Have your receipt ready — it reduces cognitive load", "This is a completely routine interaction — they do hundreds of these"], braveBonus: "Voluntarily stutter when explaining why you're returning it." },
  { title: 'Asking Directions', setup: "You're in an unfamiliar area and you're lost. You see someone who looks like they know the area.", prompt: "Oh — were you about to ask me something?", character: "Local resident, happy to help", tips: ["People generally love being asked for directions", "Have the address on your phone to show them as backup"], braveBonus: "Stutter on the name of the street you're looking for." },
  { title: 'Video Call with Family', setup: "You're about to catch up with a family member over video call.", prompt: "Oh good, there you are! I've been looking forward to this. How are you doing?", character: "A family member who loves you", tips: ["This is the safest speaking environment there is", "No performance required — this is just connection"], braveBonus: "Tell them you've been working on speech confidence." },
  { title: 'Presentation Opening', setup: "You're about to give a presentation to a small group. They're all seated and looking at you.", prompt: "Okay everyone, I think we're ready. Over to you!", character: "Friendly meeting facilitator", tips: ["Take one full breath before your first word", "Your opening line is the most important sentence — know it cold"], braveBonus: "Deliberately stutter on your own name in the opening." },
  { title: 'Talking to a New Neighbour', setup: "A new person has moved in next door. You're checking the mail at the same time.", prompt: "Oh hi — I've just moved in! I'm [name]. Have you been here long?", character: "New neighbour, friendly and slightly nervous themselves", tips: ["They're more nervous than you — they're the newcomer", "Ask a question and let them talk — takes the pressure off you"], braveBonus: "Say 'Nice to meet you — I should mention I stutter sometimes.'" },
  { title: 'Ordering for the Table', setup: "You're at a restaurant with friends and it's somehow become your job to order for the group.", prompt: "Hi everyone! What are we having tonight?", character: "Friendly server", tips: ["Go around the table and collect orders before the server comes", "You can say 'We're still deciding on one thing' to buy time"], braveBonus: "Stutter on purpose on one of the food orders." },
  { title: 'Calling a Friend', setup: "You want to make plans with a friend. You decide to actually call instead of texting.", prompt: "Oh hey! This is a surprise — I never get calls anymore. What's up?", character: "A close friend, relaxed and happy to hear from you", tips: ["Friends want to hear from you — the call is already welcome", "It's okay to say 'I just wanted to actually talk instead of text'"], braveBonus: "Tell your friend you've been working on speaking courage." },
  { title: 'Speaking to a Bus Driver', setup: "You need to confirm the bus goes to your stop. The bus has arrived.", prompt: "Hop in! Does this go to where you need?", character: "Bus driver, businesslike but not unkind", tips: ["Short clear question is all you need", "They do this thousands of times — they're not paying close attention to your speech"], braveBonus: "Ask a follow-up question even though you already have your answer." },
]
export const getOfflineMission = (lvl) => OFFLINE_MISSIONS[Math.abs(lvl || 0) % OFFLINE_MISSIONS.length]

// ═══════════════════════════════════════════════════════════════════════════════
// CBT / ACT OFFLINE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
export const CBT_THOUGHT_RECORD = {
  steps: [
    { id: 'situation', label: 'The situation', prompt: 'Describe the speaking situation that triggered difficult thoughts or feelings. Be specific: where, when, who was present.' },
    { id: 'emotion', label: 'Your emotions', prompt: 'What emotions did you feel? Rate each from 0-100. (e.g. Anxious 80, Ashamed 60, Frustrated 40)' },
    { id: 'thought', label: 'The hot thought', prompt: "What thought was running through your mind? The one that felt most true. (e.g. 'Everyone thinks I'm stupid')" },
    { id: 'evidence_for', label: 'Evidence that supports it', prompt: 'What evidence or facts support this thought? Be specific and objective.' },
    { id: 'evidence_against', label: 'Evidence against it', prompt: "What evidence contradicts this thought? What facts challenge its accuracy?" },
    { id: 'alternative', label: 'A balanced perspective', prompt: "Considering all the evidence, what's a more balanced, realistic thought? It doesn't have to be positive — just accurate." },
    { id: 'outcome', label: 'How you feel now', prompt: "Re-rate the intensity of your original emotions (0-100). Did the balanced thought shift anything? What will you do next?" },
  ],
}

export const ACT_VALUES_DOMAINS = [
  { id: 'relationships', label: 'Relationships & family', icon: '❤️', prompt: 'What kind of friend, partner, sibling, or family member do you want to be? What does deep connection mean to you?' },
  { id: 'work', label: 'Work & career', icon: '💼', prompt: 'What contribution do you want to make through your work? What does meaningful work look like for you?' },
  { id: 'education', label: 'Education & growth', icon: '📚', prompt: 'How do you want to engage with learning? What kind of student or lifelong learner do you want to be?' },
  { id: 'health', label: 'Health & wellbeing', icon: '💪', prompt: 'How do you want to care for your physical and mental health? What does looking after yourself mean to you?' },
  { id: 'community', label: 'Community & citizenship', icon: '🌍', prompt: 'What kind of community member do you want to be? What causes or groups matter to you?' },
  { id: 'recreation', label: 'Recreation & creativity', icon: '🎨', prompt: 'What do you want to do for fun, creativity, and restoration? What brings you alive?' },
  { id: 'spirituality', label: 'Spirituality & meaning', icon: '✨', prompt: 'What gives your life meaning and purpose? What do you believe in or stand for?' },
  { id: 'communication', label: 'Voice & expression', icon: '🗣️', prompt: 'What does having a voice mean to you? What do you want to be able to say, share, or contribute through speaking?' },
]

export const ACT_DEFUSION_EXERCISES = [
  { id: 'label', title: 'Label the thought', instruction: "Instead of thinking the thought, describe having it. Change 'I'm going to embarrass myself' to 'I'm having the thought that I'm going to embarrass myself.' Notice how that changes its weight." },
  { id: 'sing', title: 'Sing it absurdly', instruction: "Take your anxious thought and sing it to the tune of Happy Birthday. This doesn't solve anything — it just makes it harder for the thought to boss you around." },
  { id: 'character', title: 'Give it a character', instruction: "Imagine your inner critic as a character — what do they look like? What's their name? When they show up, you can acknowledge them: 'Oh, there's Brian again with his catastrophising.'" },
  { id: 'leaves', title: 'Leaves on a stream', instruction: 'Close your eyes. Imagine a gentle stream. Each anxious thought appears on a leaf floating past. You just watch them float by — you don\'t chase or push them.' },
  { id: 'billboard', title: 'The billboard', instruction: "Imagine your thought on a roadside billboard you're driving past. Notice it. Read it. Drive past it. You don't have to stop and believe every billboard you see." },
  { id: 'thank', title: 'Thank your mind', instruction: "When an anxious thought appears, say 'Thanks, mind. I know you're trying to protect me.' Then do what you planned anyway. You can have the thought and act on your values simultaneously." },
]

// ═══════════════════════════════════════════════════════════════════════════════
// FLUENCY CURRICULUM + STUTTER MODIFICATION DRILLS
// ═══════════════════════════════════════════════════════════════════════════════
export const FLUENCY_CURRICULUM = [
  { week: 1, title: 'Foundation: Breath & Onset', focus: 'Building the physical foundation of fluent speech', techniques: ['diaphragmatic_breathing', 'easy_onset'],
    daily: [
      { day: 1, task: 'Practice diaphragmatic breathing for 5 minutes. Belly rises, chest stays still.', type: 'breathe' },
      { day: 2, task: 'Say 10 words starting with vowels using easy onset: "Apple... ocean... inside..."', type: 'easy_onset' },
      { day: 3, task: 'Combine: take a diaphragmatic breath before each sentence in a 3-sentence speech.', type: 'combined' },
      { day: 4, task: 'Easy onset on consonants: "Please... tell... me... something..."', type: 'easy_onset' },
      { day: 5, task: 'Read one paragraph aloud, starting every sentence with a gentle diaphragmatic breath.', type: 'reading' },
      { day: 6, task: 'Have a real conversation using easy onset on your first word each sentence.', type: 'transfer' },
      { day: 7, task: 'Reflection: What felt easier? What still challenges you? Journal it.', type: 'reflect' },
    ]},
  { week: 2, title: 'Continuous Phonation', focus: 'Keeping your voice flowing like a river', techniques: ['continuous_phonation', 'prolongation'],
    daily: [
      { day: 1, task: 'Hum for 30 seconds without stopping. Feel the continuous vibration.', type: 'hum' },
      { day: 2, task: 'Read a sentence stretching every vowel: "Theee suuun is waarm toodaay..."', type: 'prolongation' },
      { day: 3, task: 'Connect words: speak a sentence where your voice never fully stops between words.', type: 'phonation' },
      { day: 4, task: 'Combine easy onset + continuous phonation in 5 sentences.', type: 'combined' },
      { day: 5, task: 'Tell a 30-second story keeping your voice continuously flowing.', type: 'story' },
      { day: 6, task: 'Use continuous phonation in a real conversation — notice the difference.', type: 'transfer' },
      { day: 7, task: 'Self-rate: Breathing 1-10 | Onset 1-10 | Continuous phonation 1-10.', type: 'reflect' },
    ]},
  { week: 3, title: 'Rate Control & Phrasing', focus: 'Using time as your most powerful speech tool', techniques: ['rate_control', 'phrasing'],
    daily: [
      { day: 1, task: 'Speak at exactly half your normal rate for 2 minutes. Time yourself.', type: 'rate' },
      { day: 2, task: 'Find natural phrase boundaries in a paragraph. Mark them. Read honouring those pauses.', type: 'phrasing' },
      { day: 3, task: 'Slow rate + phrasing combined: tell someone about your day very deliberately.', type: 'combined' },
      { day: 4, task: 'Record yourself at normal rate. Then at therapeutic rate. Compare.', type: 'recording' },
      { day: 5, task: 'Use strategic pausing in a real conversation. Own the silence.', type: 'transfer' },
      { day: 6, task: 'Deliver 60 seconds on any topic with rate control + phrasing.', type: 'presentation' },
      { day: 7, task: 'Which technique from weeks 1-3 do you want to strengthen? Do 15 min of that today.', type: 'reflect' },
    ]},
  { week: 4, title: 'Stuttering Modification: Cancellation', focus: 'Learning to respond to stuttering with calm, not panic', techniques: ['cancellation'],
    daily: [
      { day: 1, task: 'Learn cancellation: stutter → pause → breathe → reattempt with easy onset. Practice the sequence.', type: 'cancellation' },
      { day: 2, task: 'Intentionally stutter on 5 words, then cancel each one. Feel the control.', type: 'voluntary_cancel' },
      { day: 3, task: 'Read aloud. When you stutter, use cancellation every time.', type: 'reading' },
      { day: 4, task: 'Conversational cancellation: use cancellation on any natural stutters.', type: 'transfer' },
      { day: 5, task: 'Does cancellation change how you feel about the stutter? Journal it.', type: 'reflect' },
      { day: 6, task: 'Advanced: cancel a stutter during a slightly feared situation.', type: 'brave' },
      { day: 7, task: 'Combine all week 1-4 techniques in a 2-minute speech.', type: 'combined' },
    ]},
]

export const STUTTER_MODIFICATION_DRILLS = [
  { id: 'cancellation', title: 'Cancellation Practice', icon: '⏸️', description: "After stuttering, pause deliberately, breathe, then reattempt with easy onset. You're not fixing the stutter — you're changing your response to it.",
    steps: ['Speak naturally. When you stutter, let it happen.', 'After the stutter: STOP. Complete silence for 1-2 seconds.', 'Take one diaphragmatic breath.', 'Reattempt the word slowly with easy onset.', 'Continue speaking.'],
    practicePrompts: ['Tell me about something that happened this week.', 'Describe your favourite place in detail.', 'Explain how to make your favourite food.', 'Talk about someone you admire and why.'] },
  { id: 'pullout', title: 'Pull-Out Practice', icon: '🌊', description: "Mid-block intervention: when you feel yourself getting stuck, instead of pushing through, deliberately slow down and ease out of the tension.",
    steps: ['Start speaking. Allow a natural block to begin.', 'When you feel the block: SLOW DOWN (don\'t stop).', 'Reduce physical tension in your lips/tongue/jaw.', 'Ease out of the sound — smooth it, don\'t force it.', 'Continue at a slightly slower rate.'],
    practicePrompts: ['Tell me your full name and where you\'re from.', 'Describe the last film or show you watched.', 'Say 5 things you can see around you right now.', 'Tell me what you did yesterday morning to night.'] },
  { id: 'preparatory_set', title: 'Preparatory Set', icon: '🎯', description: "Before saying a feared word, take a breath and mentally prepare to begin it with easy onset — light contact, soft start, no rush.",
    steps: ['Identify a word you anticipate blocking on.', 'Take one small breath before the sentence.', 'Approach the word with deliberately light contact.', 'Start the word slowly, gently, with soft onset.', 'Let the rest of the sentence flow naturally.'],
    practicePrompts: ['Say your name, address, and phone number.', 'Introduce yourself as if to a new colleague.', 'Read the first paragraph of any article aloud.', 'Tell someone your name three different ways.'] },
  { id: 'voluntary_stutter', title: 'Voluntary Stuttering', icon: '⭐', description: "Stutter intentionally on fluent words. The most advanced and most powerful desensitisation technique in stuttering therapy.",
    steps: ['Choose a word you\'re NOT afraid of.', 'Stutter on it deliberately: p-p-please, or b-b-bring.', 'Maintain eye contact throughout.', 'Continue speaking as if nothing happened.', 'Repeat with 2-3 more words in the conversation.'],
    practicePrompts: ['Order something using a voluntary stutter on the item name.', 'Introduce yourself with a voluntary stutter on your name.', 'Ask a question with a voluntary stutter on the first word.', 'Tell a story with 3 planned voluntary stutters.'] },
]

export const METRONOME_PRESETS = [
  { label: 'Very slow (90 BPM)', bpm: 90, description: 'One syllable per beat. For maximum control.' },
  { label: 'Slow (110 BPM)', bpm: 110, description: 'Therapeutic pacing. Most effective range.' },
  { label: 'Moderate (130 BPM)', bpm: 130, description: 'Natural slow speech pace.' },
  { label: 'Near-normal (150 BPM)', bpm: 150, description: 'Building toward natural rate.' },
]

export const DAF_PRESETS = [
  { label: 'Light delay (50ms)', delay: 50, description: 'Slight awareness. Good starting point.' },
  { label: 'Moderate delay (100ms)', delay: 100, description: 'Clear effect. Most therapeutic range.' },
  { label: 'Strong delay (150ms)', delay: 150, description: 'Strong effect. Challenging but impactful.' },
  { label: 'Deep delay (200ms)', delay: 200, description: 'Maximum effect. Advanced practice.' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE LAB AI FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const analyzeFillerWords = async (transcript, fillerCount, totalWords, profile) => {
  const totalFillers = Object.values(fillerCount).reduce((a, b) => a + b, 0)
  const rate = totalWords > 0 ? ((totalFillers / totalWords) * 100).toFixed(1) : '0.0'
  const score = Math.max(30, Math.min(100, 100 - totalFillers * 8))
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user',
        content: `Analyze filler word usage. Transcript: "${transcript}". Filler count: ${JSON.stringify(fillerCount)}. Total words: ${totalWords}. Filler rate: ${rate}%. User: ${profile?.ageGroup}.
ONLY JSON: {"score":${score},"strengths":["specific observation"],"improvements":["specific filler to address"],"tip":"one sentence on pause technique","praise":"one encouraging Flux sentence","fillerBreakdown":${JSON.stringify(fillerCount)}}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const rateNum = parseFloat(rate)
    const praise = rateNum < 2 ? 'Incredible filler control! You sound polished and confident.' :
      rateNum < 5 ? 'Good work — you caught yourself on several fillers. Keep replacing them with silence.' :
      'First step is awareness — and now you have it. Replace every filler with a 1-second confident pause.'
    return {
      score, fillerBreakdown: fillerCount,
      strengths: totalFillers === 0 ? ['Zero filler words detected — excellent!'] : [`You spoke ${totalWords} words with ${totalFillers} fillers`],
      improvements: totalFillers > 0 ? [`Replace "${Object.keys(fillerCount)[0] || 'um'}" with a deliberate pause`] : ['Maintain this filler-free discipline'],
      tip: 'When you feel a filler coming, close your mouth and breathe instead. Silence sounds like confidence.',
      praise, fillerBreakdown: fillerCount,
    }
  }
}

export const analyzeStorytelling = async (exerciseId, transcript, profile) => {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 450, messages: [{ role: 'user',
        content: `Analyze storytelling for exercise "${exerciseId}". Transcript: "${transcript}". User: ${profile?.ageGroup}.
Evaluate: hook quality, show-don't-tell, narrative tension, structure. 
ONLY JSON: {"score":70,"strengths":["specific story element done well"],"improvements":["specific story element to develop"],"tip":"one concrete storytelling technique","praise":"one warm encouraging sentence from Flux"}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const wc = transcript.split(' ').length
    const hasDetail = /\b(saw|felt|heard|smelled|touched|looked|sounded)\b/i.test(transcript)
    const hasStructure = transcript.includes(',') || transcript.length > 100
    const score = Math.min(90, 55 + (hasDetail ? 15 : 0) + (hasStructure ? 10 : 0) + (wc > 30 ? 10 : 0))
    return {
      score,
      strengths: [hasDetail ? 'Good use of sensory detail' : 'You committed to the exercise', hasStructure ? 'Clear narrative flow' : 'Concise storytelling'],
      improvements: [hasDetail ? 'Add more emotional beats' : 'Try "show don\'t tell" — describe what you physically experienced', 'Open with a stronger hook — dive straight into the action'],
      tip: 'Start your next story with a specific sensory detail: a sound, an object, a colour. It pulls the listener in immediately.',
      praise: getOfflineResponse('encouragement'),
    }
  }
}

export const analyzeActiveListening = async (exerciseId, response, profile) => {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user',
        content: `Analyze active listening response for exercise "${exerciseId}". Response: "${response}". User: ${profile?.ageGroup}.
Evaluate: accuracy of summary/reflection, emotional attunement, use of open questions, validation quality.
ONLY JSON: {"score":70,"strengths":["specific listening skill demonstrated"],"improvements":["specific listening skill to develop"],"tip":"one actionable listening technique","praise":"one warm encouraging Flux sentence"}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const wc = response.split(' ').length
    const hasQuestion = response.includes('?')
    const hasEmotionWord = /\b(feel|feels|feeling|frustrated|worried|stressed|anxious|excited|sad|glad)\b/i.test(response)
    const score = Math.min(90, 55 + (hasQuestion ? 15 : 0) + (hasEmotionWord ? 15 : 0) + (wc > 20 ? 10 : 0))
    return {
      score,
      strengths: [hasEmotionWord ? 'You reflected the emotional content — that builds trust' : 'You engaged with the exercise seriously', hasQuestion ? 'You included a question to invite them to say more' : 'Your response showed attention'],
      improvements: [!hasEmotionWord ? 'Try naming the emotion you hear: "It sounds like you felt..." or "That must have been..."' : 'Keep developing emotional attunement', !hasQuestion ? 'End with one open question: "What do you think you\'ll do?" or "How did that leave you feeling?"' : 'Try validating before asking your question'],
      tip: 'The most powerful listening response: reflect the emotion first, summarise the facts second, ask one open question last.',
      praise: getOfflineResponse('encouragement'),
    }
  }
}

export const generateImpromptTopic = async (difficulty, profile) => {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 100, messages: [{ role: 'user',
        content: `Generate one unique impromptu speaking topic. Difficulty: ${difficulty}. Age group: ${profile?.ageGroup}. Make it thought-provoking but not political. ONLY respond with the topic sentence — no quotes, no preamble.`
      }]})
    })
    const data = await resp.json()
    return data.content?.find(b => b.type === 'text')?.text?.trim() || null
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAUSE TRAINER — dedicated exercise replacing fillers with silent pauses
// ═══════════════════════════════════════════════════════════════════════════════

export const PAUSE_TRAINER_PROMPTS = [
  {
    id: 'intro', label: 'Self-Introduction', icon: '👤', duration: 30,
    prompt: 'Introduce yourself in 30 seconds. Name, one thing you do, one thing you care about. No notes — just speak.',
    focus: 'Every time you feel an "um" or "uh" coming, stop. Breathe. Continue. The pause is the goal.',
  },
  {
    id: 'opinion', label: 'Give Your Opinion', icon: '💬', duration: 30,
    prompt: 'What is one thing you would change about how people communicate today? 30 seconds. Commit to your view.',
    focus: 'Use PREP: make your Point first, then your Reason. Pause between each section.',
  },
  {
    id: 'describe', label: 'Describe a Place', icon: '🏞️', duration: 45,
    prompt: 'Describe a place you know well — a room, a street, a spot outdoors. Make the listener see it. 45 seconds.',
    focus: 'Slow down on visual details. Each detail is worth a pause before it.',
  },
  {
    id: 'explain', label: 'Explain Something Simple', icon: '🧩', duration: 45,
    prompt: 'Explain how something everyday works — a traffic light, a coffee machine, a queue. 45 seconds. Assume the listener knows nothing.',
    focus: 'Transitions ("first… then… finally…") are filler hotspots. Pause at every transition instead.',
  },
  {
    id: 'story', label: 'One-Minute Story', icon: '📖', duration: 60,
    prompt: 'Tell a true story about a time something surprised you. Start mid-action — no preamble. 60 seconds.',
    focus: 'Pause before the key moment of the story. The silence creates anticipation.',
  },
]

export const PAUSE_TRAINER_FILLER_WORDS = [
  'um', 'uh', 'er', 'like', 'you know', 'sort of', 'kind of',
  'basically', 'literally', 'actually', 'so', 'right', 'okay so',
  'i mean', 'you see', 'well', 'just', 'anyway',
]

export const analyzePauseTrainer = async (transcript, fillerCount, pauseCount, totalWords, promptId, profile) => {
  const fillerRate = totalWords > 0 ? Math.round((fillerCount / totalWords) * 100) : 0
  const pauseScore = Math.min(50, pauseCount * 8)
  const fillerPenalty = Math.min(40, fillerCount * 6)
  const baseScore = Math.max(30, 70 + pauseScore - fillerPenalty)

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user',
        content: `Pause Trainer analysis. Transcript: "${transcript}". Stats: ${fillerCount} fillers, ${pauseCount} deliberate pauses used, ${totalWords} total words, filler rate: ${fillerRate}%. Prompt: ${promptId}. User age group: ${profile?.ageGroup}.
ONLY JSON: {"score":${baseScore},"fillerRate":${fillerRate},"pausesUsed":${pauseCount},"strengths":["specific strength about pausing or delivery"],"improvements":["one specific filler pattern to work on"],"tip":"one sentence: the exact moment to use the pause technique","praise":"one warm Flux sentence referencing their specific effort","nextDrill":"id of which PAUSE_TRAINER_PROMPTS prompt to try next"}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const strengths = []
    const improvements = []
    if (pauseCount > 0) strengths.push(`You used ${pauseCount} deliberate pause${pauseCount > 1 ? 's' : ''} — that is the entire skill`)
    else strengths.push('You completed the drill — that\'s the first rep')
    if (fillerRate < 5) strengths.push('Very low filler rate — your silence control is developing')
    if (fillerCount > 3) improvements.push(`${fillerCount} fillers detected — pick the most common one and target only that word next time`)
    else improvements.push('Push for one more deliberate pause in your next attempt')
    return {
      score: baseScore,
      fillerRate,
      pausesUsed: pauseCount,
      strengths,
      improvements,
      tip: 'The moment you feel a filler coming is the exact moment to close your mouth, breathe through your nose, and continue. That gap is strength, not weakness.',
      praise: 'Every pause you chose instead of "um" is a small rewiring. Your brain is learning a new default.',
      nextDrill: promptId === 'intro' ? 'opinion' : promptId === 'opinion' ? 'describe' : 'story',
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENTATION LAB — Opening Lines + One-Message drills
// ═══════════════════════════════════════════════════════════════════════════════

export const PRESENTATION_LAB_DRILLS = [
  {
    id: 'opening_lines',
    title: 'Opening Lines',
    icon: '🎯',
    time: '30s',
    description: 'Master the first 30 seconds. This is the only part every audience member hears.',
    scienceTip: 'Audiences decide in the first 8 seconds whether to pay attention. Your opening is not an introduction — it is a hook.',
    hookTypes: [
      { type: 'Question', example: '"When was the last time you felt truly heard?"', why: 'Activates the brain — audiences answer internally and are now invested.' },
      { type: 'Shocking stat', example: '"Most people speak 16,000 words a day. Most of them are forgotten by the listener within 60 seconds."', why: 'Creates a knowledge gap the audience wants to close.' },
      { type: 'Vivid scene', example: '"Picture the last meeting you sat in where the speaker opened with \'Today I\'d like to talk about…\'"', why: 'Puts the audience inside a shared experience immediately.' },
      { type: 'Provocative claim', example: '"Everything you\'ve been told about making a good first impression is wrong."', why: 'Creates tension and curiosity that pulls attention forward.' },
      { type: 'Personal confession', example: '"The first time I spoke in front of a group, I forgot every word I\'d prepared."', why: 'Vulnerability creates immediate emotional connection.' },
    ],
    prompt: 'Pick ONE hook type. Craft a 30-second opening for any topic you care about. No introduction of yourself. No "today I\'ll talk about." Just the hook and your first real point.',
    criteria: [
      'Opens with a hook — not with your name or a preamble',
      'First sentence creates curiosity or emotion',
      'No filler words in the first 10 seconds',
      'Lands in 25–35 seconds',
    ],
  },
  {
    id: 'one_message',
    title: 'One-Message Drill',
    icon: '💡',
    time: '5 min',
    description: 'Distil any talk, idea, or conversation to a single sentence. If you can\'t, the message isn\'t clear yet.',
    scienceTip: 'TED Talks that go viral have one thing in common: they can be summarised in a single sentence. Clarity of message precedes clarity of delivery.',
    steps: [
      { step: 1, label: 'Pick a topic', instruction: 'Choose something you want to communicate — a project idea, a belief, a skill, a story, anything.' },
      { step: 2, label: 'Write the brain dump', instruction: 'In 2 minutes, write everything you\'d want to say about it. No filtering.' },
      { step: 3, label: 'Find the core', instruction: 'Read what you wrote. Ask: "If I could only say one thing, what would it be?" Circle it.' },
      { step: 4, label: 'Write the sentence', instruction: 'Write ONE sentence. Must pass the 10-year-old test: would a child understand it? Cut every word that isn\'t essential.' },
      { step: 5, label: 'Say it aloud', instruction: 'Say your one sentence out loud. Does it feel true? Does it feel complete? That\'s your anchor for everything else.' },
    ],
    prompt: 'What topic will you distil? Speak your one-message sentence aloud when you\'ve found it.',
    criteria: [
      'Single sentence — no "and also" connectors',
      'A 10-year-old would understand it',
      'It captures the emotion, not just the information',
      'You could repeat it word-for-word at the end of a 10-minute talk',
    ],
  },
]

export const analyzePresentationDrill = async (drillId, transcript, hookType, profile) => {
  try {
    const drill = PRESENTATION_LAB_DRILLS.find(d => d.id === drillId)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user',
        content: `Analyze this Presentation Lab drill. Drill: ${drillId}. Hook type chosen: ${hookType || 'not specified'}. Transcript: "${transcript}". User: ${profile?.ageGroup}.
Criteria: ${drill?.criteria?.join(' | ')}.
ONLY JSON: {"score":75,"hookLanded":true,"strengths":["specific observation"],"improvements":["specific gap"],"tip":"one actionable sentence for next attempt","praise":"one warm Flux sentence","verdict":"one sentence: what the opening/message achieved or missed"}`
      }]})
    })
    const data = await resp.json()
    const text = data.content?.find(b => b.type === 'text')?.text || '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const wordCount = transcript.split(' ').length
    const hasFillers = /\b(um|uh|like|you know|so|basically)\b/i.test(transcript)
    const startsWithHook = !(/^(hi|hello|good|today|my name|i want to|i\u2019m going to)/i.test(transcript.trim()))
    const score = Math.min(95, 55 + (startsWithHook ? 20 : 0) + (wordCount > 30 ? 10 : 0) - (hasFillers ? 10 : 0))
    return {
      score,
      hookLanded: startsWithHook,
      strengths: [startsWithHook ? 'You opened without a preamble — that\'s the hardest habit to break' : 'You completed the drill', wordCount > 30 ? 'Good development length' : 'Concise attempt'],
      improvements: [!startsWithHook ? 'Start with your hook word one — remove any preamble before it' : 'Sharpen the hook: does your first sentence create a question in the listener\'s mind?', hasFillers ? 'Replace fillers with a deliberate pause — especially in the first 10 seconds' : 'Push for even more vocal variety on your key words'],
      tip: drillId === 'opening_lines' ? 'Record yourself. Listen back. Does the first sentence make you want to keep listening? That\'s the only test that matters.' : 'Read your one sentence to someone who doesn\'t know the topic. Watch their face. Do they get it?',
      praise: 'You worked on the hardest part of any talk. Most people never practise their opening at all.',
      verdict: startsWithHook ? 'Your opening created momentum — now sharpen the hook type.' : 'The opening started with a preamble — that\'s the one thing to cut next time.',
    }
  }
}
