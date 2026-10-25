import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
const actions = [
  { key: 'transfer', nav: '/transfer', icon: <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
  { key: 'statements', nav: '/statements', icon: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/></> },
  { key: 'payBills', nav: null, icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/></> },
  { key: 'requestCard', nav: null, icon: <><rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2"/><line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2"/></> },
]
export function QuickActions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div>
      <h2 className="font-semibold text-navy mb-3 text-sm">{t('dashboard.actions.title')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map(a => (
          <button key={a.key} onClick={() => a.nav ? navigate(a.nav) : alert(t('dashboard.unavailable'))}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-border-light rounded-xl hover:border-primary hover:shadow-card transition-all min-h-[80px] group focus-visible:ring-2 focus-visible:ring-gold">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/5 group-hover:bg-primary group-hover:text-white text-primary transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">{a.icon}</svg>
            </div>
            <span className="text-xs font-medium text-navy text-center leading-tight">{t(`dashboard.actions.${a.key}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
