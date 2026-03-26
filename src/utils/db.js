import Dexie from 'dexie'

export const db = new Dexie('YoSpeechDB')

db.version(1).stores({
  profile:    '++id, name, ageGroup, avatar, createdAt',
  sessions:   '++id, type, date, duration, score, data',
  recordings: '++id, type, date, blob, duration, label',
  fearLadder: '++id, situation, fearLevel, completed, completedAt',
  progress:   '++id, zone, mission, stars, date',
  journal:    '++id, date, blob, duration, mood',
  braveStars: '++id, type, description, date',
  streaks:    '++id, date, completed',
  settings:   '++id, key, value',
})

db.version(2).stores({
  profile:    '++id, name, ageGroup, avatar, createdAt',
  sessions:   '++id, type, date, duration, score, data',
  recordings: '++id, type, date, blob, duration, label',
  fearLadder: '++id, situation, fearLevel, completed, completedAt',
  progress:   '++id, zone, mission, stars, date',
  journal:    '++id, date, blob, duration, mood',
  braveStars: '++id, type, description, date',
  streaks:    '++id, date, completed',
  settings:   '++id, key, value',
  mindshift:  '++id, type, date, data',
  scores:     '++id, date, overall, domains',
})

// Helpers
export const getProfile = () => db.profile.orderBy('id').last()
export const saveProfile = (data) => db.profile.put({ ...data, createdAt: new Date().toISOString() })

export const addSession = (type, score, data = {}) =>
  db.sessions.add({ type, score, data: JSON.stringify(data), date: new Date().toISOString(), duration: data.duration || 0 })

export const addRecording = (type, blob, duration, label = '') =>
  db.recordings.add({ type, blob, duration, label, date: new Date().toISOString() })

export const getRecentSessions = (limit = 20) =>
  db.sessions.orderBy('date').reverse().limit(limit).toArray()

export const getTotalSessions = () => db.sessions.count()

export const addBraveStar = (type, description) =>
  db.braveStars.add({ type, description, date: new Date().toISOString() })

export const getFearLadder = () => db.fearLadder.orderBy('fearLevel').toArray()

export const addFearItem = (situation, fearLevel) =>
  db.fearLadder.add({ situation, fearLevel, completed: false, completedAt: null })

export const completeFearItem = (id) =>
  db.fearLadder.update(id, { completed: true, completedAt: new Date().toISOString() })

export const getJournalEntries = () => db.journal.orderBy('date').reverse().toArray()

export const addJournalEntry = (blob, duration, mood) =>
  db.journal.add({ blob, duration, mood, date: new Date().toISOString() })

export const getZoneProgress = (zone) => db.progress.where('zone').equals(zone).toArray()

export const saveZoneProgress = (zone, mission, stars) =>
  db.progress.add({ zone, mission, stars, date: new Date().toISOString() })

export const getTodayStreak = async () => {
  const today = new Date().toDateString()
  return db.streaks.where('date').equals(today).first()
}

export const markTodayStreak = async () => {
  const today = new Date().toDateString()
  const existing = await getTodayStreak()
  if (!existing) await db.streaks.add({ date: today, completed: true })
}

export const getStreakCount = async () => {
  const entries = await db.streaks.orderBy('date').reverse().toArray()
  let count = 0
  const now = new Date()
  for (let i = 0; i < entries.length; i++) {
    const d = new Date(entries[i].date)
    const diff = Math.floor((now - d) / 86400000)
    if (diff === i) count++
    else break
  }
  return count
}

export const getSetting = async (key, defaultVal = null) => {
  const row = await db.settings.where('key').equals(key).first()
  return row ? row.value : defaultVal
}

export const setSetting = async (key, value) => {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing) await db.settings.update(existing.id, { value })
  else await db.settings.add({ key, value })
}

// v2 additions
export const getSessionsByType = (type, limit = 20) =>
  db.sessions.where('type').equals(type).reverse().limit(limit).toArray()

export const getSessionCount = () => db.sessions.count()

export const clearMemory = async () => {
  const memKeys = [
    'flux_insights','flux_strengths','flux_weaknesses','flux_recs','flux_story','flux_goals',
    'flux_moods','flux_techniques','flux_convo_history',
    'mindshift_records','mindshift_values',
    'stutterscore_history','fluentpath_progress','neurobrain_unlocked',
  ]
  for (const k of memKeys) await db.settings.where('key').equals(k).delete()
}
