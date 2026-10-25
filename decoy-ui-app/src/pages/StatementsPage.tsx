import { useEffect, useState, useRef } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { LoadingButton } from '../components/shared/LoadingButton'
import { bankApi } from '../api/bankApi'
import { useTranslation } from '../i18n/useTranslation'
const STATEMENTS = [
  { key:'oct2026', filename:'statement-2024-10.pdf', sizeKey:'statements.size.oct' },
  { key:'sep2026', filename:'statement-2024-09.pdf', sizeKey:'statements.size.sep' },
  { key:'aug2026', filename:'statement-2024-08.pdf', sizeKey:'statements.size.aug' },
]
export function StatementsPage() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File|null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadOk, setUploadOk] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { document.title = t('statements.pageTitle') }, [t])
  const ALLOWED_EXT = ['.jpg','.jpeg','.png','.pdf','.doc','.docx']
  const checkExt = (f: File) => { const ext = '.' + f.name.split('.').pop()!.toLowerCase(); return ALLOWED_EXT.includes(ext) }
  const pick = (f: File) => { if (!checkExt(f)) { setUploadMsg(t('error.fileType')); setUploadOk(false); return }; setFile(f); setUploadMsg('') }
  const upload = async () => {
    if (!file) { setUploadMsg(t('error.fileRequired')); return }
    setUploading(true); setUploadMsg('')
    const res = await bankApi.kycUpload(file)
    if (res.ok) { setUploadMsg(t('statements.kyc.success')); setUploadOk(true); setFile(null); if (inputRef.current) inputRef.current.value = '' }
    else { setUploadMsg((res as any).message || t('error.generic')); setUploadOk(false) }
    setUploading(false)
  }
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <NavBar/>
      <main className="flex-1 px-4 py-10 max-w-3xl mx-auto w-full" id="main-content">
        {/* Statements */}
        <section className="bg-white rounded-2xl shadow-card p-6 mb-6" aria-labelledby="stmt-heading">
          <h1 id="stmt-heading" className="font-serif text-xl font-bold text-navy mb-1">{t('statements.title')}</h1>
          <p className="text-text-muted text-sm mb-5">{t('statements.subtitle')}</p>
          <ul className="space-y-3">
            {STATEMENTS.map(s => (
              <li key={s.key} className="flex items-center justify-between p-4 border border-border-light rounded-xl hover:border-primary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-danger-bg rounded-lg flex items-center justify-center text-danger flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div>
                    <p className="font-medium text-navy text-sm">{t(`statements.${s.key}`)}</p>
                    <p className="text-text-muted text-xs">{t(s.sizeKey)}</p>
                  </div>
                </div>
                <a href={`/api/v1/bank/statements/${s.filename}`} download aria-label={`${t('aria.downloading')} ${t(`statements.${s.key}`)}`}
                  className="flex items-center gap-2 min-h-[44px] px-4 text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-gold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {t('statements.download')}
                </a>
              </li>
            ))}
          </ul>
        </section>
        {/* KYC */}
        <section className="bg-white rounded-2xl shadow-card p-6" aria-labelledby="kyc-heading">
          <h2 id="kyc-heading" className="font-serif text-xl font-bold text-navy mb-1">{t('statements.kyc.title')}</h2>
          <p className="text-text-muted text-sm mb-5">{t('statements.kyc.subtitle')}</p>
          <div
            role="button" tabIndex={0}
            aria-label={t('aria.upload')}
            onClick={() => inputRef.current?.click()}
            onKeyDown={e => { if (e.key==='Enter'||e.key===' ') inputRef.current?.click() }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) pick(f) }}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary'}`}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dragOver?'#1B2B5E':'#9ca3af'} strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p className="font-medium text-navy text-sm">{file ? `${t('statements.kyc.selected')}: ${file.name}` : t('statements.kyc.dropzone')}</p>
            <p className="text-text-muted text-xs mt-1">{t('statements.kyc.hint')}</p>
          </div>
          <input ref={inputRef} type="file" name="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" className="sr-only" aria-hidden="true" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f) }}/>
          <div className="mt-4">
            <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="doc-type">{t('statements.kyc.docType')}</label>
            <select id="doc-type" className="rounded border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="proof_of_identity">{t('statements.kyc.nationalId')}</option>
              <option value="proof_of_address">{t('statements.kyc.utilityBill')}</option>
            </select>
          </div>
          {uploadMsg && <div className={`mt-3 p-3 rounded text-sm ${uploadOk ? 'bg-success-bg text-success border border-success-border' : 'bg-danger-bg text-danger border border-danger-border'}`} role="alert">{uploadMsg}</div>}
          <LoadingButton loading={uploading} onClick={upload} className="mt-4 bg-primary hover:bg-primary-dark text-white">{uploading ? t('statements.kyc.uploading') : t('statements.kyc.submit')}</LoadingButton>
        </section>
      </main>
      <Footer/>
    </div>
  )
}
