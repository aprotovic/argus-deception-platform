import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { bankApi } from '../../api/bankApi'
import { LoadingButton } from '../shared/LoadingButton'
import { useCountdown } from '../../hooks/useCountdown'
interface Props { username: string; maskedPhone: string }
export function OtpStep({ username, maskedPhone }: Props) {
  const { t } = useTranslation()
  const [digits, setDigits] = useState(['','','','','',''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const { seconds, isRunning, start } = useCountdown(60)
  useEffect(() => { start() }, [])

  const submit = async (code: string) => {
    if (code.length !== 6) { setError(t('error.otpLength')); return }
    setError(''); setLoading(true)
    try {
      const res = await bankApi.otp(username, code)
      if (!res.ok) {
        if (res.status === 429) setError(t('error.rateLimit'))
        else setError(res.message || t('otp.expiredMessage'))
      } else {
        // Server always returns 403; if somehow 200, still show expiry
        setError(t('otp.expiredMessage'))
      }
    } finally { setLoading(false) }
  }

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]; next[i] = val; setDigits(next)
    if (val && i < 5) refs.current[i+1]?.focus()
    if (next.every(d => d) && next.join('').length === 6) submit(next.join(''))
  }
  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i-1]?.focus()
  }

  const resend = async () => {
    setError(''); start()
    await bankApi.otpResend(username)
    setError(t('otp.resendSuccess'))
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex justify-center mb-5">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
      </div>
      <h2 className="font-serif text-2xl font-bold text-navy mb-2 text-center">{t('otp.title')}</h2>
      <p className="text-text-muted text-sm text-center mb-6">{t('otp.instruction')} <strong>{maskedPhone}</strong>.</p>
      <div className="flex justify-center gap-2 mb-4" role="group" aria-label={t('otp.label')}>
        {digits.map((d, i) => (
          <input key={i}
            ref={el => { refs.current[i] = el }}
            type="text" inputMode="numeric" pattern="[0-9]" maxLength={1}
            value={d} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKey(i, e)}
            aria-label={`${t('aria.otpInput')} ${i+1} ${t('aria.otpBox')}`}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            className="w-10 h-12 text-center text-lg font-bold border-2 border-border-light rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
          />
        ))}
      </div>
      {error && (
        <div className={`mb-3 p-2 text-sm rounded text-center ${error === t('otp.resendSuccess') ? 'bg-success-bg text-success border border-success-border' : 'bg-danger-bg text-danger border border-danger-border'}`} role="alert" aria-live="polite">
          {error}
        </div>
      )}
      <LoadingButton loading={loading} onClick={() => submit(digits.join(''))} className="w-full bg-primary hover:bg-primary-dark text-white">
        {t('otp.submit')}
      </LoadingButton>
      <div className="text-center mt-3">
        {isRunning ? (
          <p className="text-text-muted text-sm">{t('otp.resendIn')} {seconds} {t('otp.seconds')}</p>
        ) : (
          <button onClick={resend} className="text-primary text-sm hover:underline min-h-[44px] px-4 focus-visible:ring-2 focus-visible:ring-gold rounded">{t('otp.resend')}</button>
        )}
      </div>
      <p className="text-text-muted text-xs text-center mt-4">{t('otp.expiry')}</p>
      <p className="text-warning text-xs text-center mt-2">{t('otp.security')}</p>
    </div>
  )
}
