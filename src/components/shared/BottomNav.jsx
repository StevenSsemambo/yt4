import { useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { path: '/home',      icon: '🏠', label: 'Home' },
  { path: '/adventure', icon: '🗺️', label: 'Explore' },
  { path: '/flux-chat', icon: '💧', label: 'Flux', special: true },
  { path: '/progress',  icon: '🌌', label: 'Stars' },
  { path: '/settings',  icon: '⚙️', label: 'You' },
]

export default function BottomNav() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const hidden    = ['/onboarding', '/flux-chat'].includes(location.pathname)
  if (hidden) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom max-w-md mx-auto">
      <div className="glass-dark border-t mx-0 px-2 py-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex justify-around items-center">
          {NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path === '/adventure' && ['/adventure','/comm','/brave','/speaklab','/breathe','/talktales','/journal','/family','/fluentpath','/mindshift','/stutterscore','/neurobrain','/voicelab'].includes(location.pathname))
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`nav-pill ${active ? 'active' : ''} ${item.special ? 'relative' : ''}`}>
                {item.special ? (
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-200
                    ${active
                      ? 'text-[#05080f]'
                      : 'glass-2 text-white/50 hover:text-white/80'}`}
                    style={active ? { background: 'var(--aqua)', boxShadow: 'var(--glow-aqua)' } : {}}>
                    {item.icon}
                  </div>
                ) : (
                  <>
                    <span className={`text-xl transition-all duration-200 ${active ? 'scale-110' : ''}`}>{item.icon}</span>
                    <span className="text-[10px] font-display font-semibold">{item.label}</span>
                    {active && <div className="absolute bottom-0 w-1 h-1 rounded-full" style={{ background: 'var(--aqua)' }}/>}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
