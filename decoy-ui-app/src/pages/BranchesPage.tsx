import { useEffect, useState } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { MapPin, Phone, Clock, Search } from 'lucide-react'
import { useScrollReveal } from '../hooks/useScrollReveal'

const BRANCHES = [
  { name:'Bole Main Branch', area:'Bole', address:'Bole Sub-City, Woreda 03', phone:'+251 11 000 0001', hours:'Mon–Fri 08:00–17:00', type:'branch', atm:true },
  { name:'Piassa Branch', area:'Arada', address:'Arada Sub-City, Woreda 02', phone:'+251 11 000 0002', hours:'Mon–Fri 08:00–17:00', type:'branch', atm:true },
  { name:'Megenagna Branch', area:'Yeka', address:'Yeka Sub-City, Woreda 07', phone:'+251 11 000 0003', hours:'Mon–Sat 08:00–14:00', type:'branch', atm:true },
  { name:'Kazanchis Branch', area:'Kirkos', address:'Kirkos Sub-City, Woreda 01', phone:'+251 11 000 0004', hours:'Mon–Fri 08:00–17:00', type:'branch', atm:false },
  { name:'Merkato Branch', area:'Addis Ketema', address:'Addis Ketema Sub-City, Woreda 05', phone:'+251 11 000 0005', hours:'Mon–Fri 08:00–17:00', type:'branch', atm:true },
  { name:'CMC Branch', area:'Yeka', address:'Yeka Sub-City, Woreda 12', phone:'+251 11 000 0006', hours:'Mon–Sat 08:00–15:00', type:'branch', atm:false },
  { name:'Bole Medhanialem ATM', area:'Bole', address:'Bole Medhanialem Church Area', phone:'N/A', hours:'24 Hours', type:'atm', atm:true },
  { name:'Edna Mall ATM', area:'Bole', address:'Edna Mall Shopping Center', phone:'N/A', hours:'24 Hours', type:'atm', atm:true },
]

export function BranchesPage() {
  useEffect(() => { document.title = 'Branches & ATMs – Geberew Bank' }, [])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const { ref, visible } = useScrollReveal()
  const filtered = BRANCHES.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.area.toLowerCase().includes(search.toLowerCase())
    const matchType = type === 'all' || b.type === type
    return matchSearch && matchType
  })

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1">
        <section className="bg-primary py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%"><defs><pattern id="bp2" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#bp2)"/></svg>
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-4">Find Us</span>
            <h1 className="font-serif text-4xl font-bold text-white mb-4">Branches & ATMs</h1>
            <p className="text-white/60 max-w-xl mx-auto">Find your nearest Geberew Bank branch or ATM across Addis Ababa and regional cities.</p>
          </div>
        </section>

        <section className="bg-white py-14 px-4">
          <div className="max-w-6xl mx-auto">
            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or area…"
                  className="w-full pl-10 pr-4 py-3 border border-border-light rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"/>
              </div>
              <div className="flex gap-2">
                {[['all','All'],['branch','Branches'],['atm','ATMs']].map(([v,l]) => (
                  <button key={v} onClick={() => setType(v)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${type===v ? 'bg-primary text-white' : 'bg-primary-faint text-primary hover:bg-primary/10'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div ref={ref} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              {filtered.map((b, i) => (
                <div key={b.name}
                  className="bg-surface border border-border-light rounded-2xl p-5 shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-gold/30 transition-all duration-300"
                  style={{ transitionDelay: `${(i % 6) * 60}ms` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${b.type === 'atm' ? 'bg-gold' : 'bg-primary'}`}>
                        {b.type === 'atm' ? 'ATM' : 'BR'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-primary text-sm">{b.name}</h3>
                        <span className="text-[10px] text-gold font-semibold uppercase tracking-wide">{b.area}</span>
                      </div>
                    </div>
                    {b.atm && <span className="text-[9px] bg-gold-faint text-gold font-bold px-2 py-0.5 rounded-full">ATM</span>}
                  </div>
                  <div className="space-y-1.5 text-xs text-text-muted">
                    <div className="flex items-start gap-2"><MapPin size={11} className="mt-0.5 flex-shrink-0 text-gold"/>{b.address}</div>
                    {b.type === 'branch' && <div className="flex items-center gap-2"><Phone size={11} className="flex-shrink-0 text-gold"/>{b.phone}</div>}
                    <div className="flex items-center gap-2"><Clock size={11} className="flex-shrink-0 text-gold"/>{b.hours}</div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-text-muted">No branches found matching your search.</div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  )
}
