import { useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { LoadingButton } from '../shared/LoadingButton'
export interface TransferFormData { from_acct: string; routing: string; recipient: string; amount: string; memo: string }
interface Props { data: TransferFormData; onChange: (d: TransferFormData) => void; onNext: () => void }
export function TransferStep1({ data, onChange, onNext }: Props) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Partial<Record<keyof TransferFormData, string>>>({})
  const set = (k: keyof TransferFormData) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => onChange({ ...data, [k]: e.target.value })
  const validate = () => {
    const errs: typeof errors = {}
    if (!data.routing.trim()) errs.routing = t('error.routingRequired')
    if (!data.recipient.trim()) errs.recipient = t('error.recipientRequired')
    const amt = parseFloat(data.amount.replace(',',''))
    if (!data.amount || isNaN(amt) || amt <= 0) errs.amount = t('error.amountRequired')
    setErrors(errs); return Object.keys(errs).length === 0
  }
  return (
    <div>
      <div className="mb-5">
        <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="from_acct">{t('transfer.fromAcct')} <span className="text-danger" aria-hidden="true">*</span></label>
        <select id="from_acct" name="from_acct" value={data.from_acct} onChange={set('from_acct')} className="w-full rounded border border-border-light px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="checking7823">{t('transfer.checking')}</option>
          <option value="savings3341">{t('transfer.savings')}</option>
        </select>
      </div>
      {([
        { k:'routing', label:'transfer.routing', ph:'transfer.routingPlaceholder', max:34 },
        { k:'recipient', label:'transfer.recipient', ph:'transfer.recipientPlaceholder', max:100 },
        { k:'amount', label:'transfer.amount', ph:'transfer.amountPlaceholder', max:20 },
        { k:'memo', label:'transfer.memo', ph:'transfer.memoPlaceholder', max:280 },
      ] as const).map(f => (
        <div key={f.k} className="mb-4">
          <label className="block text-sm font-medium text-text-dark mb-1" htmlFor={f.k}>
            {t(f.label)} {f.k !== 'memo' && <span className="text-danger" aria-hidden="true">*</span>}
            {f.k === 'memo' && <span className="text-text-muted font-normal"> {t('transfer.optional')}</span>}
          </label>
          <input id={f.k} type={f.k==='amount'?'number':'text'} value={(data as any)[f.k]} onChange={set(f.k as keyof TransferFormData)}
            placeholder={t(f.ph)} maxLength={f.max} min={f.k==='amount'?'0.01':undefined} step={f.k==='amount'?'0.01':undefined}
            className={`w-full rounded border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition ${(errors as any)[f.k] ? 'border-danger' : 'border-border-light'}`}/>
          {(errors as any)[f.k] && <p className="text-danger text-xs mt-1" role="alert">{(errors as any)[f.k]}</p>}
        </div>
      ))}
      <LoadingButton onClick={() => { if (validate()) onNext() }} className="w-full bg-primary hover:bg-primary-dark text-white mt-2">{t('transfer.next')}</LoadingButton>
    </div>
  )
}
