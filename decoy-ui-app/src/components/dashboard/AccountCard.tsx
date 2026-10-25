import { useTranslation } from '../../i18n/useTranslation'
interface Props { label: string; masked: string; balance: number; type: string }
export function AccountCard({ label, masked, balance, type }: Props) {
  const { t, currency } = useTranslation()
  return (
    <div className="bg-gradient-to-br from-primary to-primary-dark text-white rounded-xl p-6 shadow-card-hover relative overflow-hidden" role="region" aria-label={`${label} ${masked}`}>
      <div className="absolute right-0 top-0 w-32 h-32 opacity-10 pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="60" fill="#D4930A"/><circle cx="64" cy="64" r="40" fill="#1B2B5E"/></svg>
      </div>
      <p className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-1">{label}</p>
      <p className="font-mono text-lg tracking-wider mb-3">{masked}</p>
      <p className="text-xs text-white/60 mb-1">{type}</p>
      <p className="font-serif text-2xl font-bold" aria-label={`${t('dashboard.spending.title')}: ${currency(balance)}`}>{currency(balance)}</p>
    </div>
  )
}
