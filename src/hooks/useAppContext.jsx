import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getProfile, getTotalSessions, getStreakCount, markTodayStreak, getSetting, setSetting, db } from '../utils/db'

const AppContext = createContext(null)

export const AppProvider = ({ children }) => {
  const [profile,       setProfile]       = useState(null)
  const [totalSessions, setTotalSessions] = useState(0)
  const [streak,        setStreak]        = useState(0)
  const [fluxMessage,   setFluxMessage]   = useState('')
  const [showFluxMsg,   setShowFluxMsg]   = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [notification,  setNotification]  = useState(null)
  const [userEmail,     setUserEmail]     = useState('')
  const [todayMood,     setTodayMood]     = useState(null)

  const loadProfile = useCallback(async () => {
    try {
      const [p, sessions, s, email, mood] = await Promise.all([
        getProfile(),
        getTotalSessions(),
        getStreakCount(),
        getSetting('user_email', ''),
        getSetting('today_mood', null),
      ])
      setProfile(p)
      setTotalSessions(sessions)
      setStreak(s)
      setUserEmail(email || '')
      setTodayMood(mood)
    } catch (e) {
      console.error('loadProfile error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  const showNotification = useCallback((msg, type = 'success', duration = 3000) => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), duration)
  }, [])

  const triggerFlux = useCallback((msg, duration = 5000) => {
    setFluxMessage(msg)
    setShowFluxMsg(true)
    setTimeout(() => setShowFluxMsg(false), duration)
  }, [])

  const refreshProfile = useCallback(async () => {
    await markTodayStreak()
    await loadProfile()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await Promise.all([
      setSetting('onboarded', false),
      setSetting('user_email', ''),
      setSetting('auth_method', ''),
      db.profile.clear(),
    ])
    setProfile(null)
    setUserEmail('')
  }, [])

  return (
    <AppContext.Provider value={{
      profile, setProfile,
      totalSessions, setTotalSessions,
      streak,
      fluxMessage, showFluxMsg, triggerFlux,
      loading,
      refreshProfile, loadProfile,
      notification, showNotification,
      userEmail,
      todayMood, setTodayMood,
      signOut,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
