import { useApp } from '../../hooks/useAppContext'

export default function Notification() {
  const { notification } = useApp()
  if (!notification) return null

  const styles = {
    success: { bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)',  color: 'var(--jade)' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',   color: '#f87171'     },
    info:    { bg: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.3)',  color: 'var(--aqua)' },
    brave:   { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)',  color: 'var(--amber)'},
  }[notification.type] || { bg:'rgba(34,211,238,0.15)', border:'rgba(34,211,238,0.3)', color:'var(--aqua)' }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%] px-4 py-3 rounded-2xl animate-slide-down"
         style={{ background: styles.bg, border: `1px solid ${styles.border}`, backdropFilter: 'blur(20px)' }}>
      <p className="font-display font-semibold text-sm text-center" style={{ color: styles.color }}>
        {notification.msg}
      </p>
    </div>
  )
}
