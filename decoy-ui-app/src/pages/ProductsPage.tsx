import { useEffect, useState } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { ArrowRight, ChevronRight } from 'lucide-react'

const CATEGORIES = ['All','Personal','Business','Loans','Cards','Digital']

const PRODUCTS = [
  { cat:'Personal', title:'Personal Checking', tag:'Everyday Banking', body:'Zero-fee daily banking with instant transfers, branch access, and no minimum balance requirement.' },
  { cat:'Personal', title:"Women's Savings", tag:'Special Account', body:'Higher interest rates, supermarket discounts, and dedicated financial planning for Ethiopian women.' },
  { cat:'Business', title:'Business Current', tag:'Enterprise', body:'Unlimited transactions, overdraft facility, dedicated relationship manager, and trade finance.' },
  { cat:'Business', title:'Business Savings', tag:'Corporate', body:'Earn returns on idle corporate funds with flexible withdrawal terms and competitive interest.' },
  { cat:'Loans', title:'Personal Loan', tag:'Quick Finance', body:'Fast approval for personal financing needs. Flexible repayment from 6 months to 5 years.' },
  { cat:'Loans', title:'Mortgage Loan', tag:'Home Finance', body:'Become a homeowner with our flexible mortgage products tailored for Addis Ababa and beyond.' },
  { cat:'Cards', title:'Classic Debit Card', tag:'Visa Debit', body:'Accepted at millions of merchants worldwide. Free card, free ATM withdrawals at our network.' },
  { cat:'Cards', title:'Platinum Credit Card', tag:'Premium', body:'Up to Br 200,000 credit limit, travel insurance, and exclusive merchant offers.' },
  { cat:'Digital', title:'Mobile Banking', tag:'24/7 Access', body:'Full banking from your phone — transfers, payments, statements, account management.' },
  { cat:'Digital', title:'Online Banking', tag:'Web Platform', body:'Comprehensive web banking platform with bulk payments, payroll, and detailed reporting.' },
  { cat:'Digital', title:'GeberewAmeen', tag:'Interest-Free', body:'Shari\'a-compliant products — Mudarabah, Musharakah, Murabahah, and Ijarah accounts.' },
  { cat:'Personal', title:'Term Deposits', tag:'Fixed Return', body:'Lock in competitive rates for 3, 6, or 12 months. Guaranteed returns on your savings.' },
]

export function ProductsPage() {
  useEffect(() => { document.title = 'Products & Services – Geberew Bank' }, [])
  const [active, setActive] = useState('All')
  const { ref, visible } = useScrollReveal()
  const filtered = active === 'All' ? PRODUCTS : PRODUCTS.filter(p => p.cat === active)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1">
        <section className="bg-primary py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%"><defs><pattern id="pp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#pp)"/></svg>
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-4">What We Offer</span>
            <h1 className="font-serif text-4xl font-bold text-white mb-4">Products & Services</h1>
            <p className="text-white/60 max-w-xl mx-auto text-base">Comprehensive financial solutions designed for every Ethiopian — from personal accounts to enterprise banking.</p>
          </div>
        </section>

        <section className="bg-white py-14 px-4">
          <div className="max-w-6xl mx-auto">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 mb-10 justify-center">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setActive(c)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${active===c ? 'bg-primary text-white shadow-card' : 'bg-primary-faint text-primary hover:bg-primary/10'}`}>
                  {c}
                </button>
              ))}
            </div>

            <div ref={ref} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              {filtered.map((p, i) => (
                <div key={p.title}
                  className="bg-surface border border-border-light rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:-translate-y-1.5 hover:border-gold/30 transition-all duration-300 cursor-pointer group"
                  style={{ transitionDelay: `${(i % 6) * 60}ms` }}>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-gold bg-gold-faint px-2.5 py-1 rounded-full mb-3">{p.tag}</span>
                  <h3 className="font-serif text-lg font-bold text-primary mb-2 group-hover:text-gold transition-colors">{p.title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed mb-4">{p.body}</p>
                  <button className="flex items-center gap-1.5 text-primary group-hover:text-gold text-sm font-semibold transition-colors">
                    Learn more <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform"/>
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
