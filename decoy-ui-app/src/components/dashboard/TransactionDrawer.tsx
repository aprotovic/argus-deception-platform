import { useEffect } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
export interface Transaction { id: string; date: string; description: string; amount: number; type: 'credit'|'debit'; balance: number; reference: string }
interface Props { tx: Transaction | null; onClose: () => void }
export function TransactionDrawer({ tx, onClose }: Props) {
  const { t, currency } = useTranslation()
  useEffect(() => {
    if (!tx) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [tx, onClose])
  return (
    <>
      {tx && <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} aria-hidden="true"/>}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-40 shadow-2xl transition-transform duration-300 ${tx ? 'translate-x-0' : 'translate-x-full'}`} role="dialog" aria-modal="true" aria-label={t('aria.transactionDetails')}>
        {tx && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-5 border-b border-border-light">
              <h2 className="font-serif font-bold text-navy text-base">{t('dashboard.transactions.details')}</h2>
              <button onClick={onClose} aria-label={t('aria.closeDrawer')} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className={`text-center p-6 rounded-xl ${tx.type === 'credit' ? 'bg-success-bg' : 'bg-danger-bg'}`}>
                <p className={`font-serif text-3xl font-bold ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                  {tx.type === 'credit' ? '+' : '-'}{currency(Math.abs(tx.amount))}
                </p>
                <p className="text-text-muted text-sm mt-1">{tx.description}</p>
              </div>
              {[
                [t('dashboard.transactions.date'), tx.date],
                [t('dashboard.transactions.type'), tx.type === 'credit' ? t('dashboard.transactions.filter.credit') : t('dashboard.transactions.filter.debit')],
                [t('dashboard.transactions.balance'), currency(tx.balance)],
                [t('dashboard.transactions.reference'), tx.reference],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm py-2 border-b border-border-light">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-navy">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
