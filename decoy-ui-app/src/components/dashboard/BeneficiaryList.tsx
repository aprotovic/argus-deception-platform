import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
const BENEFICIARIES = [
  { id: 1, name: 'Almaz Tadesse', account: '••••1204' },
  { id: 2, name: 'Biruk Tesfaye', account: '••••8871' },
  { id: 3, name: 'Selamawit Haile', account: '••••5530' },
]
export function BeneficiaryList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="bg-white rounded-xl border border-border-light p-5 shadow-card">
      <h2 className="font-semibold text-navy text-sm mb-4">{t('dashboard.beneficiaries.title')}</h2>
      <ul className="space-y-3">
        {BENEFICIARIES.map(b => (
          <li key={b.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                {b.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy truncate">{b.name}</p>
                <p className="text-xs text-text-muted">{b.account}</p>
              </div>
            </div>
            <button onClick={() => navigate('/transfer')} className="min-h-[36px] px-3 text-xs bg-primary/10 hover:bg-primary hover:text-white text-primary rounded font-medium transition-colors focus-visible:ring-2 focus-visible:ring-gold">
              {t('dashboard.beneficiaries.transfer')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
