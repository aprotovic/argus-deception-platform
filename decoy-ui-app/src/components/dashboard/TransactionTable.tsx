import { useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { TransactionDrawer, Transaction } from './TransactionDrawer'

const TRANSACTIONS: Transaction[] = [
  { id:'1', date:'Nov 14, 2026', description:'Salary Deposit — Addis Ababa City Admin', amount:15200, type:'credit', balance:12450.50, reference:'REF-2026-001' },
  { id:'2', date:'Nov 12, 2026', description:'Shoa Supermarket — Bole', amount:875.30, type:'debit', balance:9250.50, reference:'REF-2026-002' },
  { id:'3', date:'Nov 11, 2026', description:'Ethio Telecom — Airtime', amount:100, type:'debit', balance:10125.80, reference:'REF-2026-003' },
  { id:'4', date:'Nov 09, 2026', description:'Ethiopian Electric — Power Bill', amount:420, type:'debit', balance:10225.80, reference:'REF-2026-004' },
  { id:'5', date:'Nov 07, 2026', description:'Anbessa City Bus — Transport Card', amount:200, type:'debit', balance:10645.80, reference:'REF-2026-005' },
  { id:'6', date:'Nov 05, 2026', description:'Online Transfer to Savings', amount:2000, type:'debit', balance:10845.80, reference:'REF-2026-006' },
  { id:'7', date:'Nov 01, 2026', description:'Salary Deposit — Addis Ababa City Admin', amount:15200, type:'credit', balance:12845.80, reference:'REF-2026-007' },
  { id:'8', date:'Oct 29, 2026', description:"Kaldi's Coffee — Kazanchis", amount:95, type:'debit', balance:9645.80, reference:'REF-2026-008' },
  { id:'9', date:'Oct 25, 2026', description:'National Bank Service Fee', amount:50, type:'debit', balance:9740.80, reference:'REF-2026-009' },
  { id:'10', date:'Oct 22, 2026', description:'Merkato Market — Groceries', amount:640, type:'debit', balance:9790.80, reference:'REF-2026-010' },
]

export function TransactionTable() {
  const { t, currency } = useTranslation()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState<Transaction | null>(null)

  const filtered = TRANSACTIONS.filter(tx => {
    const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || tx.type === typeFilter
    return matchSearch && matchType
  })

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('dashboard.transactions.search')} aria-label={t('aria.searchTransactions')}
          className="flex-1 rounded border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label={t('aria.filterType')}
          className="rounded border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">{t('dashboard.transactions.filter.all')}</option>
          <option value="credit">{t('dashboard.transactions.filter.credit')}</option>
          <option value="debit">{t('dashboard.transactions.filter.debit')}</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">{t('dashboard.transactions.noResults')}</p>
      ) : (
        <>
          {/* Table for md+ */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border-light">
            <table className="min-w-full text-sm" aria-label={t('dashboard.transactions.title')}>
              <thead className="bg-surface">
                <tr>
                  {['date','description','amount','balance'].map(h => (
                    <th key={h} scope="col" className="py-3 px-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{t(`dashboard.transactions.${h}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light bg-white">
                {filtered.map(tx => (
                  <tr key={tx.id} onClick={() => setSelected(tx)} className="hover:bg-surface cursor-pointer transition-colors" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setSelected(tx) }} aria-label={t('aria.transactionDetails')}>
                    <td className="py-3 px-4 text-text-muted whitespace-nowrap">{tx.date}</td>
                    <td className="py-3 px-4 text-navy">{tx.description}</td>
                    <td className={`py-3 px-4 font-semibold whitespace-nowrap ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{currency(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-text-muted whitespace-nowrap">{currency(tx.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Stacked cards for small screens */}
          <div className="md:hidden space-y-2">
            {filtered.map(tx => (
              <button key={tx.id} onClick={() => setSelected(tx)} className="w-full bg-white border border-border-light rounded-xl p-4 text-left hover:border-primary transition-colors focus-visible:ring-2 focus-visible:ring-gold">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy truncate">{tx.description}</p>
                    <p className="text-xs text-text-muted mt-0.5">{tx.date}</p>
                  </div>
                  <span className={`font-semibold text-sm ml-2 flex-shrink-0 ${tx.type === 'credit' ? 'text-success' : 'text-danger'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{currency(tx.amount)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      <TransactionDrawer tx={selected} onClose={() => setSelected(null)}/>
    </>
  )
}
