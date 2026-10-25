import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
const NOTIFS = [
  { key: 'n1', timeKey: 'n1.time' },
  { key: 'n2', timeKey: 'n2.time' },
  { key: 'n3', timeKey: 'n3.time' },
]
export function NotificationsDropdown() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label={t('aria.notifications')} className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors focus-visible:ring-2 focus-visible:ring-gold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
        <span className="absolute top-2 right-2 w-2 h-2 bg-gold rounded-full" aria-hidden="true"/>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-border-light rounded-xl shadow-xl z-20 animate-fade-in">
          <div className="px-4 py-3 border-b border-border-light">
            <h3 className="font-semibold text-navy text-sm">{t('dashboard.notifications.title')}</h3>
          </div>
          <ul>
            {NOTIFS.map(n => (
              <li key={n.key} className="px-4 py-3 border-b border-border-light last:border-0 hover:bg-surface transition-colors">
                <p className="text-sm text-text-dark leading-snug">{t(`dashboard.notifications.${n.key}`)}</p>
                <p className="text-xs text-text-muted mt-1">{t(`dashboard.notifications.${n.timeKey}`)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
