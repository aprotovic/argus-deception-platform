import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
export function ProfileMenu() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const username = sessionStorage.getItem('mtb_session') || 'User'
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const signOut = () => { sessionStorage.clear(); navigate('/login', { replace: true }) }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label={t('aria.profile')} className="flex items-center gap-2 min-h-[44px] px-3 rounded-lg hover:bg-primary/10 transition-colors focus-visible:ring-2 focus-visible:ring-gold">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{username.charAt(0).toUpperCase()}</div>
        <span className="hidden sm:inline text-sm font-medium text-navy max-w-[100px] truncate">{username}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-border-light rounded-xl shadow-xl z-20 animate-fade-in">
          <button onClick={() => { alert(t('dashboard.unavailable')); setOpen(false) }} className="w-full min-h-[44px] text-left px-4 py-3 text-sm text-text-dark hover:bg-surface transition-colors rounded-t-xl">{t('dashboard.profile.title')}</button>
          <button onClick={() => { alert(t('dashboard.unavailable')); setOpen(false) }} className="w-full min-h-[44px] text-left px-4 py-3 text-sm text-text-dark hover:bg-surface transition-colors">{t('dashboard.profile.settings')}</button>
          <button onClick={signOut} className="w-full min-h-[44px] text-left px-4 py-3 text-sm text-danger hover:bg-danger-bg transition-colors rounded-b-xl">{t('dashboard.profile.signOut')}</button>
        </div>
      )}
    </div>
  )
}
