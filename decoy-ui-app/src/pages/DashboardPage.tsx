import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { AccountCard } from '../components/dashboard/AccountCard'
import { TransactionTable } from '../components/dashboard/TransactionTable'
import { SpendingDonut } from '../components/shared/SpendingDonut'
import { QuickActions } from '../components/dashboard/QuickActions'
import { BeneficiaryList } from '../components/dashboard/BeneficiaryList'
import { NotificationsDropdown } from '../components/dashboard/NotificationsDropdown'
import { ProfileMenu } from '../components/dashboard/ProfileMenu'
import { Sidebar } from '../components/dashboard/Sidebar'
import { SessionTimeoutModal } from '../components/dashboard/SessionTimeoutModal'
import { SkeletonCard } from '../components/shared/SkeletonCard'
import { useIdleTimer } from '../hooks/useIdleTimer'
import { BankLogo } from '../components/shared/BankLogo'

const ACCOUNTS = [
  { id:'chk', label:'CHECKING ACCOUNT', labelKey:'dashboard.accounts.checking.label', masked:'••••• •••• 7823', balance:12450.50, type:'dashboard.accounts.checking.type' },
  { id:'sav', label:'SAVINGS ACCOUNT', labelKey:'dashboard.accounts.savings.label', masked:'••••• •••• 3341', balance:34009.00, type:'dashboard.accounts.savings.type' },
]
const SPENDING = [
  { label:'Dining', pct:32, color:'#1B2B5E', key:'dining' },
  { label:'Shopping', pct:27, color:'#D4930A', key:'shopping' },
  { label:'Utilities', pct:18, color:'#4b7c5f', key:'utilities' },
  { label:'Transport', pct:12, color:'#e0b56a', key:'transport' },
  { label:'Other', pct:11, color:'#9eb8aa', key:'other' },
]

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTimeout, setShowTimeout] = useState(false)

  // Auth guard
  useEffect(() => {
    if (!sessionStorage.getItem('mtb_session')) navigate('/login', { replace: true })
    else { const id = setTimeout(() => setLoading(false), 400); return () => clearTimeout(id) }
  }, [navigate])

  useEffect(() => { document.title = t('dashboard.pageTitle') }, [t])

  useIdleTimer(() => setShowTimeout(true), () => { sessionStorage.clear(); navigate('/login', { replace: true }) })

  const username = sessionStorage.getItem('mtb_session') || 'User'
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-ET', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
      <div className="flex-1 min-w-0 lg:pl-64">
        {/* Top bar */}
        <header className="bg-white border-b border-border-light sticky top-0 z-20 px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gold" aria-label={t('nav.openMenu')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="lg:hidden flex items-center gap-1">
            <BankLogo size={24}/>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationsDropdown/>
            <ProfileMenu/>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 max-w-6xl mx-auto" id="main-content">
          <div className="mb-6">
            <p className="text-lg font-serif font-semibold text-navy">{t('dashboard.welcome')}, {username}</p>
            <p className="text-text-muted text-sm">{dateStr}</p>
            <p className="text-xs text-text-muted mt-1">{t('dashboard.lastLogin')}</p>
          </div>

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SkeletonCard height="h-32"/><SkeletonCard height="h-32"/>
              </div>
              <SkeletonCard height="h-48"/>
              <SkeletonCard height="h-64"/>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Account cards */}
              <section aria-labelledby="accts-heading">
                <h2 id="accts-heading" className="font-semibold text-navy text-sm mb-3">{t('dashboard.accounts.title')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ACCOUNTS.map(a => <AccountCard key={a.id} label={t(a.labelKey)} masked={a.masked} balance={a.balance} type={t(a.type)}/>)}
                </div>
              </section>

              {/* Quick actions */}
              <QuickActions/>

              {/* Transactions + chart */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="xl:col-span-2 bg-white rounded-xl border border-border-light p-5 shadow-card" aria-labelledby="tx-heading">
                  <h2 id="tx-heading" className="font-semibold text-navy text-sm mb-4">{t('dashboard.transactions.title')}</h2>
                  <TransactionTable/>
                </section>
                <section className="bg-white rounded-xl border border-border-light p-5 shadow-card" aria-labelledby="spending-heading">
                  <h2 id="spending-heading" className="font-semibold text-navy text-sm mb-1">{t('dashboard.spending.title')}</h2>
                  <p className="text-text-muted text-xs mb-4">{t('dashboard.spending.subtitle')}</p>
                  <SpendingDonut segments={SPENDING}/>
                </section>
              </div>

              {/* Beneficiaries */}
              <BeneficiaryList/>
            </div>
          )}
        </main>
      </div>
      <SessionTimeoutModal isOpen={showTimeout} onContinue={() => setShowTimeout(false)} onLogout={() => { sessionStorage.clear(); navigate('/login', { replace: true }) }}/>
    </div>
  )
}
