import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { TransferStep1, TransferFormData } from '../components/transfer/TransferStep1'
import { TransferStep2 } from '../components/transfer/TransferStep2'
import { TransferStep3 } from '../components/transfer/TransferStep3'
import { bankApi } from '../api/bankApi'
import { useTranslation } from '../i18n/useTranslation'
export function TransferPage() {
  const { t } = useTranslation(); const navigate = useNavigate()
  const [step, setStep] = useState<1|2|3>(1)
  const [data, setData] = useState<TransferFormData>({ from_acct:'checking7823', routing:'', recipient:'', amount:'', memo:'' })
  const [loading, setLoading] = useState(false)
  const [ref, setRef] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!sessionStorage.getItem('mtb_session')) navigate('/login', { replace: true })
    document.title = t('transfer.pageTitle')
  }, [t, navigate])
  const confirm = async () => {
    setError(''); setLoading(true)
    try {
      const res = await bankApi.transfer(data)
      if (!res.ok) { setError(res.message || t('error.generic')); return }
      const match = (res.data as any).message?.match(/MTB-[A-Z0-9]+/)
      setRef(match ? match[0] : 'MTB-00000000'); setStep(3)
    } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <NavBar/>
      <main className="flex-1 px-4 py-10" id="main-content">
        <div className="max-w-lg mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${step > i ? 'bg-primary border-primary text-white' : step === i ? 'border-primary text-primary' : 'border-gray-300 text-gray-400'}`}>{step > i ? '✓' : i}</div>
                {i < 3 && <div className={`flex-1 h-0.5 transition-colors ${step > i ? 'bg-primary' : 'bg-gray-200'}`}/>}
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-card p-6 sm:p-8">
            <h1 className="font-serif text-2xl font-bold text-navy mb-6">
              {step === 1 ? t('transfer.step1.title') : step === 2 ? t('transfer.step2.title') : t('transfer.step3.title')}
            </h1>
            {error && <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger text-sm rounded" role="alert">{error}</div>}
            {step === 1 && <TransferStep1 data={data} onChange={setData} onNext={() => setStep(2)}/>}
            {step === 2 && <TransferStep2 data={data} loading={loading} onBack={() => setStep(1)} onConfirm={confirm}/>}
            {step === 3 && <TransferStep3 referenceNumber={ref}/>}
          </div>
          {step < 3 && <p className="text-text-muted text-xs text-center mt-4">{t('transfer.branchNote')}</p>}
        </div>
      </main>
      <Footer/>
    </div>
  )
}
