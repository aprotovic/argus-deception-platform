import { useTranslation } from '../../i18n/useTranslation'
import { LoadingButton } from '../shared/LoadingButton'
import type { TransferFormData } from './TransferStep1'
interface Props { data: TransferFormData; loading: boolean; onBack: () => void; onConfirm: () => void }
export function TransferStep2({ data, loading, onBack, onConfirm }: Props) {
  const { t, currency } = useTranslation()
  const acctLabel = data.from_acct === 'checking7823' ? t('transfer.checking') : t('transfer.savings')
  const rows = [
    [t('transfer.fromAcct'), acctLabel],
    [t('transfer.routing'), data.routing],
    [t('transfer.recipient'), data.recipient],
    [t('transfer.amount'), currency(parseFloat(data.amount) || 0)],
    ...(data.memo ? [[t('transfer.memo'), data.memo]] : []),
  ]
  return (
    <div>
      <div className="bg-surface rounded-xl border border-border-light divide-y divide-border-light mb-6">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-text-muted">{k}</span>
            <span className="font-medium text-navy text-right ml-4 max-w-xs truncate">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <LoadingButton onClick={onBack} className="flex-1 border border-border-light text-text-dark hover:bg-surface">{t('transfer.back')}</LoadingButton>
        <LoadingButton loading={loading} onClick={onConfirm} className="flex-1 bg-primary hover:bg-primary-dark text-white">
          {loading ? t('transfer.confirming') : t('transfer.confirm')}
        </LoadingButton>
      </div>
    </div>
  )
}
