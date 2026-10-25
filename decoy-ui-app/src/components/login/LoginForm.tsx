import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { bankApi } from '../../api/bankApi'
import { LoadingButton } from '../shared/LoadingButton'
import { useCapsLock } from '../../hooks/useCapsLock'
interface Props { onOtpRequired: (username: string, maskedPhone: string) => void }
const REMEMBER_KEY = 'gbk_remember_user'
export function LoginForm({ onOtpRequired }: Props) {
  const { t } = useTranslation()
  const capsOn = useCapsLock()
  const [username, setUsername] = useState(() => { try { return localStorage.getItem(REMEMBER_KEY) ?? '' } catch { return '' } })
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => { try { return !!localStorage.getItem(REMEMBER_KEY) } catch { return false } })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError(t('error.usernameRequired')); return }
    if (!password) { setError(t('error.passwordRequired')); return }
    if (password.length > 256) { setError(t('error.passwordLength')); return }
    setLoading(true)
    try {
      if (remember) { try { localStorage.setItem(REMEMBER_KEY, username) } catch {} } else { try { localStorage.removeItem(REMEMBER_KEY) } catch {} }
      const res = await bankApi.login(username, password)
      if (!res.ok) {
        if (res.status === 429) setError(t('error.rateLimit'))
        else setError(res.message || t('error.generic'))
        return
      }
      if ((res.data as any).otp_required) {
        onOtpRequired(username, (res.data as any).masked_phone || '••••••••')
      } else {
        setError(t('error.generic'))
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Last login notice */}
      <div className="mb-4 text-xs text-text-muted bg-surface border border-border-light rounded p-2">{t('login.lastLogin')}</div>
      {/* Security banner */}
      <div className="mb-4 flex items-start gap-2 bg-warning-bg border border-warning-border rounded p-3 text-xs text-warning" role="note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>{t('login.securityBanner')}</span>
      </div>

      <h1 className="font-serif text-2xl font-bold text-navy mb-1">{t('login.title')}</h1>
      <p className="text-text-muted text-sm mb-6">{t('login.subtitle')}</p>

      {error && <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger text-sm rounded" role="alert" aria-live="assertive">{error}</div>}

      <form onSubmit={handleSubmit} noValidate aria-label={t('login.title')}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="username">{t('login.username')} <span className="text-danger" aria-hidden="true">*</span></label>
          <input id="username" type="text" name="username" autoComplete="username" required aria-required="true"
            value={username} onChange={e => setUsername(e.target.value)}
            placeholder={t('login.usernamePlaceholder')} maxLength={256}
            className="w-full rounded border border-border-light px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition"/>
        </div>
        <div className="mb-1">
          <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="password">{t('login.password')} <span className="text-danger" aria-hidden="true">*</span></label>
          <input id="password" type="password" name="password" autoComplete="current-password" required aria-required="true"
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('login.passwordPlaceholder')} maxLength={256}
            className="w-full rounded border border-border-light px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition"/>
        </div>
        {capsOn && <p className="text-warning text-xs mt-1 mb-2" role="alert">{t('login.capsLockWarning')}</p>}
        <div className="flex items-center gap-2 mb-5 mt-3">
          <input id="remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-primary"/>
          <label htmlFor="remember" className="text-sm text-text-muted cursor-pointer">{t('login.rememberUsername')}</label>
        </div>
        <LoadingButton type="submit" loading={loading} className="w-full bg-primary hover:bg-primary-dark text-white">
          {t('login.submit')}
        </LoadingButton>
        <div className="text-center mt-3">
          <Link to="/recover" className="text-primary text-sm hover:underline focus-visible:ring-2 focus-visible:ring-gold rounded">{t('login.forgotPassword')}</Link>
        </div>
      </form>
      <p className="text-xs text-text-muted text-center mt-5">{t('login.newCustomer')} <Link to="/" className="text-primary hover:underline">{t('login.openAccount')}</Link></p>
    </div>
  )
}
