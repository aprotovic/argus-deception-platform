import { useEffect } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { TrendingUp, FileText, BarChart2, Users } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export function InvestorPage() {
  useEffect(() => { document.title = 'Investor Relations – Geberew Bank' }, [])
  const { ref, visible } = useScrollReveal()
  const metrics = [
    ['Br 120B+','Total Assets'],['18.5%','Capital Adequacy Ratio'],['2.1%','Non-Performing Loans'],['22%','Return on Equity'],
  ]
  const reports = [
    { title:'Annual Report 2025', date:'March 2026', size:'4.2 MB' },
    { title:'Q3 2026 Earnings', date:'November 2026', size:'1.8 MB' },
    { title:'Sustainability Report 2025', date:'April 2026', size:'3.1 MB' },
    { title:'Corporate Governance Report', date:'June 2026', size:'2.4 MB' },
  ]
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1">
        <section className="bg-primary py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%"><defs><pattern id="irp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#irp)"/></svg>
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-4">Transparency</span>
            <h1 className="font-serif text-4xl font-bold text-white mb-4">Investor Relations</h1>
            <p className="text-white/60 max-w-xl mx-auto">Financial performance, governance, and shareholder information.</p>
          </div>
        </section>

        {/* Key metrics */}
        <div className="bg-gold py-10 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {metrics.map(([v,l]) => (
              <div key={l} className="bg-white/15 rounded-2xl p-5">
                <div className="font-serif text-2xl font-bold text-white">{v}</div>
                <div className="text-white/70 text-xs mt-1 uppercase tracking-wide">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Reports */}
        <section className="bg-white py-14 px-4">
          <div ref={ref} className={`max-w-4xl mx-auto transition-all duration-600 ${visible ? 'opacity-100' : 'opacity-0 translate-y-6'}`}>
            <h2 className="font-serif text-2xl font-bold text-primary mb-2">Financial Reports</h2>
            <div className="w-10 h-1 bg-gold mb-8 rounded-full"/>
            <div className="space-y-4">
              {reports.map((r, i) => (
                <div key={r.title}
                  className="flex items-center justify-between p-5 bg-surface border border-border-light rounded-2xl hover:border-gold/30 hover:shadow-card-hover transition-all duration-300"
                  style={{ transitionDelay: `${i * 70}ms` }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-faint rounded-xl flex items-center justify-center text-primary">
                      <FileText size={18}/>
                    </div>
                    <div>
                      <p className="font-semibold text-primary text-sm">{r.title}</p>
                      <p className="text-text-muted text-xs mt-0.5">{r.date} · {r.size}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-primary-faint hover:bg-primary text-primary hover:text-white rounded-full text-xs font-semibold transition-all">
                    Download
                  </button>
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
