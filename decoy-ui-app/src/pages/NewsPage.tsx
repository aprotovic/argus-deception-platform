import { useEffect } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { ArrowRight } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

const NEWS = [
  { cat:'Press Release', date:'25 Oct 2026', title:'Geberew Bank Launches New Digital Savings Platform', body:'The new platform allows customers to open savings accounts in under 3 minutes with fully digital KYC. Over 50,000 accounts created in the first week of launch.', tag:'Technology' },
  { cat:'Notice', date:'18 Oct 2026', title:'System Maintenance Scheduled – Sunday 2 November', body:'Online banking services will be briefly unavailable on Sunday, 2 November from 02:00 to 04:00 EAT for scheduled infrastructure upgrades.', tag:'Operations' },
  { cat:'Security Alert', date:'10 Oct 2026', title:'Fraud Awareness: Protect Your Account', body:"Beware of fraudulent calls claiming to be from Geberew Bank. We will never ask for your password or verification code by phone, email, or SMS.", tag:'Security' },
  { cat:'Corporate News', date:'5 Oct 2026', title:'Geberew Bank Opens 450th Branch in Hawassa', body:'Expanding our reach across Ethiopia, Geberew Bank opened its 450th branch in the Sidama Region, bringing modern banking services closer to over 500,000 residents.', tag:'Expansion' },
  { cat:'Product Launch', date:'28 Sep 2026', title:"New Women's Savings Account Reaches 100,000 Customers", body:"Our dedicated Women's Savings Account programme has crossed 100,000 active accounts in just six months, demonstrating strong demand for empowerment-focused banking.", tag:'Products' },
  { cat:'Partnership', date:'20 Sep 2026', title:'Geberew Bank Partners With Ethio Telecom for Mobile Payments', body:'A strategic partnership to enable seamless mobile payment integration, allowing customers to pay bills and transfer funds directly from their mobile wallets.', tag:'Digital' },
]

export function NewsPage() {
  useEffect(() => { document.title = 'News & Media – Geberew Bank' }, [])
  const { ref, visible } = useScrollReveal()
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1">
        <section className="bg-primary py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%"><defs><pattern id="np" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#np)"/></svg>
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-4">Stay Informed</span>
            <h1 className="font-serif text-4xl font-bold text-white mb-4">News & Media</h1>
            <p className="text-white/60 max-w-xl mx-auto">Latest news, announcements, and updates from Geberew Bank.</p>
          </div>
        </section>
        <section className="bg-white py-14 px-4">
          <div ref={ref} className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-600 ${visible ? 'opacity-100' : 'opacity-0 translate-y-6'}`}>
            {NEWS.map((n, i) => (
              <article key={n.title}
                className="bg-surface rounded-2xl border border-border-light overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-1.5 hover:border-gold/25 transition-all duration-300 cursor-pointer group"
                style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
                <div className="h-1.5 bg-gradient-to-r from-primary to-gold"/>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold bg-gold-faint px-2.5 py-1 rounded-full">{n.cat}</span>
                    <span className="text-[10px] text-text-light">{n.date}</span>
                  </div>
                  <h2 className="font-serif font-bold text-primary text-base mb-2 leading-snug group-hover:text-gold transition-colors">{n.title}</h2>
                  <p className="text-text-muted text-xs leading-relaxed mb-4">{n.body}</p>
                  <button className="flex items-center gap-1.5 text-gold text-xs font-semibold hover:gap-2.5 transition-all">
                    Read more <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform"/>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  )
}
