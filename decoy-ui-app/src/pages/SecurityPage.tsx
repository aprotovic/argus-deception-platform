import { useEffect } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { Shield, Lock, AlertTriangle, CheckCircle } from 'lucide-react'

export function SecurityPage() {
  useEffect(() => { document.title = 'Security Tips – Geberew Bank' }, [])
  const tips = [
    { icon:<Lock size={20}/>, title:'Protect Your Password', body:'Use a strong, unique password combining uppercase, lowercase, numbers, and symbols. Never share it — not even with bank staff.' },
    { icon:<Shield size={20}/>, title:'Verify Our Identity', body:"Always check that the website address shows geberewbank.example.com before entering any credentials. Look for the padlock in your browser." },
    { icon:<AlertTriangle size={20}/>, title:'Beware of Phishing', body:'We will never ask for your password, PIN, or verification code by phone, email, or SMS. Report suspicious communications immediately.' },
    { icon:<CheckCircle size={20}/>, title:'Use Secure Networks', body:'Avoid logging in from public Wi-Fi. If you must, use a VPN. Always log out fully when using shared or public computers.' },
  ]
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1 bg-white">
        <section className="bg-primary py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true"><svg width="100%" height="100%"><defs><pattern id="sp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#sp)"/></svg></div>
          <div className="relative max-w-3xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-4">Stay Safe</span>
            <h1 className="font-serif text-4xl font-bold text-white mb-4">Security Tips</h1>
            <p className="text-white/60">How to protect your Geberew Bank account and personal information.</p>
          </div>
        </section>
        <section className="py-14 px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {tips.map((t, i) => (
              <div key={t.title}
                className="bg-primary-faint border border-border-light rounded-2xl p-7 hover:border-gold/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-gold mb-4">{t.icon}</div>
                <h3 className="font-serif text-lg font-bold text-primary mb-2">{t.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{t.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  )
}
