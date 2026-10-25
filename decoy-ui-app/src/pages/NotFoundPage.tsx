import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { useTranslation } from '../i18n/useTranslation'
export function NotFoundPage() {
  const { t } = useTranslation()
  useEffect(() => { document.title = t('notfound.pageTitle') }, [t])
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <NavBar/>
      <main className="flex-1 flex items-center justify-center px-4 py-16" id="main-content">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-3">{t('notfound.title')}</h1>
          <p className="text-text-muted mb-8 leading-relaxed">{t('notfound.message')}</p>
          <Link to="/" className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-gold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            {t('notfound.returnHome')}
          </Link>
        </div>
      </main>
      <Footer/>
    </div>
  )
}
