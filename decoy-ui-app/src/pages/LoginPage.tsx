import { useEffect } from 'react'
import { useState } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { LoginForm } from '../components/login/LoginForm'
import { OtpStep } from '../components/login/OtpStep'
import { useTranslation } from '../i18n/useTranslation'

type Phase = 'credentials' | 'otp'
export function LoginPage() {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('credentials')
  const [otpUsername, setOtpUsername] = useState('')
  const [otpPhone, setOtpPhone] = useState('')
  useEffect(() => { document.title = t('login.pageTitle') }, [t])

  const handleOtpRequired = (username: string, maskedPhone: string) => {
    sessionStorage.setItem('mtb_session', username)
    setOtpUsername(username); setOtpPhone(maskedPhone); setPhase('otp')
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <NavBar/>
      <main className="flex-1 flex" id="main-content">
        {phase === 'credentials' ? (
          <>
            {/* Form side */}
            <div className="flex-1 flex items-start justify-center px-4 py-12">
              <LoginForm onOtpRequired={handleOtpRequired}/>
            </div>
            {/* Security panel — hidden on small screens */}
            <aside className="hidden lg:flex flex-col justify-center bg-primary text-white w-80 xl:w-96 p-10 shrink-0">
              <div className="mb-6">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h2 className="font-serif text-xl font-bold mb-2">{t('login.tips.title')}</h2>
              </div>
              <ul className="space-y-4">
                {[1,2,3,4].map(i => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4930A" strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 flex-shrink-0" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    {t(`login.tips.${i}`)}
                  </li>
                ))}
              </ul>
            </aside>
          </>
        ) : (
          <div className="flex-1 flex items-start justify-center px-4 py-12">
            <OtpStep username={otpUsername} maskedPhone={otpPhone}/>
          </div>
        )}
      </main>
      <Footer/>
    </div>
  )
}
