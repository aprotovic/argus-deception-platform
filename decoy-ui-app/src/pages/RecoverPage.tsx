import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { LoadingButton } from '../components/shared/LoadingButton'
import { bankApi } from '../api/bankApi'
import { useTranslation } from '../i18n/useTranslation'
export function RecoverPage() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  useEffect(() => { document.title = t('recover.pageTitle') }, [t])
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) { setError(t('error.identifierRequired')); return }
    setError(''); setLoading(true)
    try {
      await bankApi.recover(identifier)
      setSuccess(true)
    } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <NavBar/>
      <main className="flex-1 flex items-start justify-center px-4 py-12" id="main-content">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-card p-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5 text-primary">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <h1 className="font-serif text-2xl font-bold text-navy mb-2">{t('recover.title')}</h1>
            <p className="text-text-muted text-sm mb-6 leading-relaxed">{t('recover.subtitle')}</p>
            {success ? (
              <div className="bg-success-bg border border-success-border rounded-xl p-5 text-success text-sm leading-relaxed" role="status" aria-live="polite">
                {t('recover.successMessage')}
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="identifier">
                    {t('recover.identifier')} <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <input id="identifier" type="text" name="identifier" autoComplete="username"
                    value={identifier} onChange={e => { setIdentifier(e.target.value); setError('') }}
                    placeholder={t('recover.identifierPlaceholder')} maxLength={256}
                    aria-required="true" aria-describedby={error ? 'identifier-error' : undefined}
                    className={`w-full rounded border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition ${error ? 'border-danger' : 'border-border-light'}`}/>
                  {error && <p id="identifier-error" className="text-danger text-xs mt-1" role="alert">{error}</p>}
                </div>
                <LoadingButton type="submit" loading={loading} className="w-full bg-primary hover:bg-primary-dark text-white">
                  {loading ? t('recover.sending') : t('recover.submit')}
                </LoadingButton>
              </form>
            )}
            <div className="text-center mt-5">
              <Link to="/login" className="text-primary text-sm hover:underline focus-visible:ring-2 focus-visible:ring-gold rounded">{t('recover.backToLogin')}</Link>
            </div>
          </div>
        </div>
      </main>
      <Footer/>
    </div>
  )
}
