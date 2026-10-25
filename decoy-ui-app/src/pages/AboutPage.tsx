import { useEffect } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { useTranslation } from '../i18n/useTranslation'
import { Users, Target, Eye, Award, ArrowRight } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function AboutPage() {
  const { t } = useTranslation()
  useEffect(() => { document.title = 'About Us – Geberew Bank' }, [])
  const { ref: heroRef, visible: heroVisible } = useScrollReveal()
  const { ref: missionRef, visible: missionVisible } = useScrollReveal()
  const { ref: teamRef, visible: teamVisible } = useScrollReveal()

  const leadership = [
    { name: 'Ato Girma Bekele', role: 'Chief Executive Officer', initials: 'GB' },
    { name: 'Dr. Selamawit Tadesse', role: 'Chief Financial Officer', initials: 'ST' },
    { name: 'Ato Biruk Haile', role: 'Chief Technology Officer', initials: 'BH' },
    { name: 'W/ro Almaz Tekle', role: 'Chief Risk Officer', initials: 'AT' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary relative overflow-hidden py-20 px-4">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%"><defs><pattern id="abp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#abp)"/></svg>
          </div>
          <div ref={heroRef} className={`relative max-w-4xl mx-auto text-center transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-6">Our Story</span>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white mb-5">Banking Built for Ethiopia</h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">Since 2019, Geberew Bank has been committed to providing every Ethiopian family with safe, accessible, and modern banking services — from Addis Ababa to every corner of the nation.</p>
          </div>
        </section>

        {/* Stats */}
        <div className="bg-gold py-10 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[['2.5M+','Customers'],['450+','Branches & ATMs'],['15+','Years of Service'],['Br 120B+','Assets Under Management']].map(([v,l])=>(
              <div key={l}>
                <div className="font-serif text-3xl font-bold text-white">{v}</div>
                <div className="text-white/70 text-xs mt-1 uppercase tracking-wide">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mission / Vision */}
        <section className="bg-white py-16 px-4">
          <div ref={missionRef} className={`max-w-6xl mx-auto transition-all duration-700 ${missionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <Target size={24}/>, title:'Our Mission', body:'To provide comprehensive, innovative, and accessible financial services that empower every Ethiopian family and business to achieve their goals.' },
                { icon: <Eye size={24}/>, title:'Our Vision', body:'To be the leading bank in Ethiopia — trusted, inclusive, and forward-thinking — serving as the financial backbone of our nation\'s growth.' },
                { icon: <Award size={24}/>, title:'Our Values', body:'Integrity, customer focus, innovation, and community. Every decision we make is guided by these core principles and our commitment to Ethiopia.' },
              ].map((c, i) => (
                <div key={c.title}
                  className="bg-primary-faint rounded-2xl p-7 border border-border-light hover:border-gold/30 hover:shadow-card-hover transition-all duration-300"
                  style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-gold mb-4">{c.icon}</div>
                  <h3 className="font-serif text-lg font-bold text-primary mb-3">{c.title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Leadership */}
        <section className="bg-primary-faint py-16 px-4">
          <div ref={teamRef} className={`max-w-5xl mx-auto transition-all duration-700 ${teamVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="text-center mb-10">
              <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-2">Leadership</p>
              <h2 className="font-serif text-2xl font-bold text-primary">Our Executive Team</h2>
              <div className="w-10 h-1 bg-gold mx-auto mt-3 rounded-full"/>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {leadership.map((l, i) => (
                <div key={l.name} className="text-center group"
                  style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center text-gold font-serif text-xl font-bold mx-auto mb-3 group-hover:bg-gold group-hover:text-white transition-all duration-300 shadow-card group-hover:shadow-card-hover group-hover:-translate-y-1">
                    {l.initials}
                  </div>
                  <p className="font-semibold text-primary text-sm">{l.name}</p>
                  <p className="text-text-muted text-xs mt-0.5">{l.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  )
}
