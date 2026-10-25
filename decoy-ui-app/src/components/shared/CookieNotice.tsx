import { useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
const KEY = 'gbk_cookie_accepted'
export function CookieNotice() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => { try { return !!localStorage.getItem(KEY) } catch { return false } })
  if (dismissed) return null
  const dismiss = () => { try { localStorage.setItem(KEY, '1') } catch {} setDismissed(true) }
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-navy text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-fade-in" role="banner">
      <p className="text-sm leading-relaxed max-w-2xl">{t('cookie.message')}</p>
      <button onClick={dismiss} className="flex-shrink-0 min-h-[44px] px-5 py-2 bg-gold hover:bg-gold-dark text-white rounded font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-white">
        {t('cookie.accept')}
      </button>
    </div>
  )
}
