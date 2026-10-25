import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BankLogo } from '../shared/BankLogo'
import { useTranslation } from '../../i18n/useTranslation'

const NAV = [
  { key: 'overview', path: '/dashboard', icon: <><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></> },
  { key: 'transfer', path: '/transfer', icon: <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
  { key: 'statements', path: '/statements', icon: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2"/><polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/></> },
  { key: 'support', path: '/support', icon: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></> },
]

interface Props { mobileOpen?: boolean; onClose?: () => void }

export function Sidebar({ mobileOpen = false, onClose }: Props) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true"/>}
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-border-light z-40 flex flex-col shadow-xl transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:shadow-none`}
        aria-label="Dashboard navigation">
        <div className="flex items-center gap-2 p-5 border-b border-border-light">
          <BankLogo size={28}/>
          <span className="font-serif font-bold text-navy text-sm">{t('brand.name')}</span>
          {onClose && <button onClick={onClose} className="ml-auto min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-gray-100 lg:hidden" aria-label={t('aria.closeModal')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>}
        </div>
        <nav className="flex-1 p-3" role="navigation">
          {NAV.map(n => {
            const active = pathname.endsWith(n.path.replace('/bank','')) || pathname === n.path
            return (
              <Link key={n.key} to={n.path} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors mb-1
                  ${active ? 'bg-primary text-white' : 'text-text-dark hover:bg-primary/10 hover:text-primary'}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">{n.icon}</svg>
                {t(`dashboard.nav.${n.key}`)}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
