import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { LoadingButton } from '../shared/LoadingButton'
interface Props { referenceNumber: string }
export function TransferStep3({ referenceNumber }: Props) {
  const { t } = useTranslation(); const navigate = useNavigate()
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 className="font-serif text-xl font-bold text-navy mb-2">{t('transfer.step3.title')}</h2>
      <p className="text-text-muted text-sm mb-4">{t('transfer.successMsg')}</p>
      <div className="bg-surface rounded-xl p-4 mb-6 border border-border-light">
        <p className="text-xs text-text-muted mb-1">{t('transfer.reference')}</p>
        <p className="font-mono font-bold text-lg text-navy">{referenceNumber}</p>
      </div>
      <LoadingButton onClick={() => navigate('/dashboard')} className="bg-primary hover:bg-primary-dark text-white">{t('transfer.returnDashboard')}</LoadingButton>
    </div>
  )
}
