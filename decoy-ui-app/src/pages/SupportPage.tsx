import { useEffect, useState } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { LoadingButton } from '../components/shared/LoadingButton'
import { bankApi } from '../api/bankApi'
import { useTranslation } from '../i18n/useTranslation'

const FAQS = ['q1','q2','q3','q4','q5'] as const

export function SupportPage() {
  const { t } = useTranslation()
  const [openFaq, setOpenFaq] = useState<string|null>(null)
  const [form, setForm] = useState({ full_name:'', email:'', subject:'', message:'' })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{msg:string;ok:boolean}|null>(null)
  useEffect(() => { document.title = t('support.pageTitle') }, [t])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.full_name.trim()) e.full_name = t('error.fullNameRequired')
    if (!form.email.trim()) e.email = t('error.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('error.invalidEmail')
    if (!form.subject) e.subject = t('error.subjectRequired')
    if (!form.message.trim()) e.message = t('error.messageRequired')
    setErrors(e); return Object.keys(e).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setStatus(null)
    try {
      const res = await bankApi.supportContact({ full_name: form.full_name, email: form.email, subject: form.subject, message: form.message })
      if (res.ok) { setStatus({ msg: t('support.form.success'), ok: true }); setForm({ full_name:'', email:'', subject:'', message:'' }) }
      else setStatus({ msg: (res as any).message || t('error.generic'), ok: false })
    } finally { setLoading(false) }
  }

  const subjects = ['account','loan','tech','fraud','other'] as const

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <NavBar/>
      <main className="flex-1 px-4 py-10 max-w-5xl mx-auto w-full" id="main-content">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-navy">{t('support.title')}</h1>
          <p className="text-text-muted mt-2">{t('support.subtitle')}</p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact info */}
          <section className="bg-white rounded-2xl shadow-card p-6" aria-labelledby="contact-title">
            <h2 id="contact-title" className="font-semibold text-navy mb-4">{t('support.contact.title')}</h2>
            <ul className="space-y-4">
              {[
                { icon: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.82 19.79 19.79 0 01.12 2.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.08 7.91a16 16 0 006.06 6.06l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" strokeWidth="2"/>, label: t('support.contact.phone'), value: t('brand.phone') },
                { icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></>, label: t('support.contact.email'), value: t('brand.email') },
                { icon: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/></>, label: t('support.contact.address'), value: t('brand.address') },
              ].map(c => (
                <li key={c.label} className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">{c.icon}</svg>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{c.label}</p>
                    <p className="text-sm text-navy mt-0.5 break-words">{c.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ + form */}
          <div className="lg:col-span-2 space-y-6">
            {/* FAQ */}
            <section className="bg-white rounded-2xl shadow-card p-6" aria-labelledby="faq-title">
              <h2 id="faq-title" className="font-semibold text-navy mb-4">{t('support.faq.title')}</h2>
              <dl className="space-y-2">
                {FAQS.map(q => (
                  <div key={q} className="border border-border-light rounded-xl overflow-hidden">
                    <dt>
                      <button onClick={() => setOpenFaq(openFaq === q ? null : q)}
                        className="w-full flex justify-between items-center px-4 py-3 text-sm font-semibold text-navy bg-surface hover:bg-gray-100 transition-colors min-h-[44px] text-left focus-visible:ring-2 focus-visible:ring-gold"
                        aria-expanded={openFaq === q}>
                        <span>{t(`support.faq.${q}`)}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"
                          className={`transition-transform flex-shrink-0 ml-2 ${openFaq === q ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    </dt>
                    {openFaq === q && (
                      <dd className="px-4 py-3 text-sm text-text-muted leading-relaxed border-t border-border-light bg-white">
                        {t(`support.faq.a${q.slice(1)}`)}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </section>

            {/* Contact form */}
            <section className="bg-white rounded-2xl shadow-card p-6" aria-labelledby="form-title">
              <h2 id="form-title" className="font-semibold text-navy mb-1">{t('support.form.title')}</h2>
              <p className="text-text-muted text-sm mb-5">{t('support.form.subtitle')}</p>
              {status && (
                <div className={`mb-4 p-3 rounded text-sm ${status.ok ? 'bg-success-bg border border-success-border text-success' : 'bg-danger-bg border border-danger-border text-danger'}`} role="alert">
                  {status.msg}
                </div>
              )}
              <form onSubmit={submit} noValidate className="space-y-4">
                {[
                  { k:'full_name', label:'support.form.fullName', ph:'support.form.fullNamePlaceholder', type:'text', autoComplete:'name' },
                  { k:'email', label:'support.form.email', ph:'support.form.emailPlaceholder', type:'email', autoComplete:'email' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-sm font-medium text-text-dark mb-1" htmlFor={f.k}>{t(f.label)} <span className="text-danger" aria-hidden="true">*</span></label>
                    <input id={f.k} type={f.type} autoComplete={f.autoComplete} value={(form as any)[f.k]} onChange={set(f.k)}
                      placeholder={t(f.ph)} maxLength={254}
                      className={`w-full rounded border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition ${errors[f.k] ? 'border-danger' : 'border-border-light'}`}/>
                    {errors[f.k] && <p className="text-danger text-xs mt-1" role="alert">{errors[f.k]}</p>}
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="subject">{t('support.form.subject')} <span className="text-danger" aria-hidden="true">*</span></label>
                  <select id="subject" name="subject" value={form.subject} onChange={set('subject')}
                    className={`w-full rounded border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition ${errors.subject ? 'border-danger' : 'border-border-light'}`}>
                    <option value="">{t('support.form.subjectPlaceholder')}</option>
                    {subjects.map(s => <option key={s} value={t(`support.form.subject.${s}`)}>{t(`support.form.subject.${s}`)}</option>)}
                  </select>
                  {errors.subject && <p className="text-danger text-xs mt-1" role="alert">{errors.subject}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="message">{t('support.form.message')} <span className="text-danger" aria-hidden="true">*</span></label>
                  <textarea id="message" name="message" rows={5} value={form.message} onChange={set('message')}
                    placeholder={t('support.form.messagePlaceholder')} maxLength={2000}
                    className={`w-full rounded border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary transition resize-none ${errors.message ? 'border-danger' : 'border-border-light'}`}/>
                  {errors.message && <p className="text-danger text-xs mt-1" role="alert">{errors.message}</p>}
                </div>
                <LoadingButton type="submit" loading={loading} className="w-full bg-primary hover:bg-primary-dark text-white">
                  {loading ? t('support.form.sending') : t('support.form.submit')}
                </LoadingButton>
              </form>
            </section>
          </div>
        </div>
      </main>
      <Footer/>
    </div>
  )
}
