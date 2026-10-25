import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { CookieNotice } from '../components/shared/CookieNotice'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { useCounter } from '../hooks/useCounter'
import { ArrowRight, Shield, Lock, Smartphone, CreditCard, Building2, Globe, ChevronRight, Play, CheckCircle2, TrendingUp } from 'lucide-react'

/* ── Animated stat ─────────────────────────────── */
function AnimatedStat({ value, suffix, label, start }: { value: number; suffix: string; label: string; start: boolean }) {
  const count = useCounter(value, 1800, start)
  return (
    <div>
      <div className="text-xl sm:text-2xl font-bold text-gold">{count.toLocaleString()}{suffix}</div>
      <div className="text-white/40 text-[11px] mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  )
}

/* ── Hero ──────────────────────────────────────── */
const SLIDES = [
  {
    tag: 'Online Banking',
    h1: 'Bank Smarter,', h2: 'Live Better.',
    p: 'Experience seamless digital banking with Geberew Bank. Manage accounts, transfer funds, and pay bills — all in one secure place.',
    cta: 'Start Banking Online',
    ctaLink: '/login',
  },
  {
    tag: 'Mobile Banking',
    h1: 'Banking At', h2: 'Your Fingertips.',
    p: 'Download the Geberew Bank mobile app and manage all your finances anytime, anywhere. Fast, secure, and always available.',
    cta: 'Explore Mobile Banking',
    ctaLink: '/products',
  },
  {
    tag: 'Savings & Wealth',
    h1: 'Grow Your', h2: 'Wealth With Us.',
    p: 'Earn competitive interest on savings. Our flexible accounts help every Ethiopian family build a secure financial future.',
    cta: 'View Savings Plans',
    ctaLink: '/products',
  },
]

function Hero() {
  const [cur, setCur] = useState(0)
  const [fading, setFading] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => { setCur(c => (c+1)%SLIDES.length); setFading(false) }, 350)
    }, 6500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.5 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  const s = SLIDES[cur]
  return (
    <section className="relative bg-primary overflow-hidden" style={{minHeight:'600px'}}>
      {/* Animated particle orbs */}
      <div className="absolute top-12 right-24 w-48 h-48 rounded-full bg-gold/8 particle-1 pointer-events-none"/>
      <div className="absolute bottom-16 left-12 w-32 h-32 rounded-full bg-white/4 particle-2 pointer-events-none"/>
      <div className="absolute top-1/3 right-1/3 w-16 h-16 rounded-full bg-gold/6 particle-3 pointer-events-none"/>
      <div className="absolute bottom-1/4 right-16 w-20 h-20 rounded-full bg-primary-light/30 animate-float-slow pointer-events-none"/>

      {/* Hex grid bg */}
      <div className="absolute inset-0 opacity-[0.035]" aria-hidden="true">
        <svg width="100%" height="100%"><defs><pattern id="hex" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M40 0 L80 20 L80 60 L40 80 L0 60 L0 20 Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#hex)"/></svg>
      </div>
      {/* Radial glow */}
      <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{background:'radial-gradient(circle at 70% 20%, rgba(212,147,10,0.14) 0%, transparent 65%)'}}/>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Text content */}
          <div className={`transition-all duration-500 ${fading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[11px] font-bold uppercase tracking-widest text-gold border border-gold/30 bg-gold/10">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"/>
              {s.tag}
            </span>
            <h1 className="font-serif leading-[1.08] tracking-tight text-white mb-5">
              <span className="block text-4xl sm:text-5xl xl:text-6xl font-bold">{s.h1}</span>
              <span className="block text-4xl sm:text-5xl xl:text-6xl font-bold gradient-text-gold">{s.h2}</span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-8 max-w-md">{s.p}</p>
            <div className="flex flex-wrap gap-3">
              <Link to={s.ctaLink}
                className="btn-magnetic ripple-btn inline-flex items-center gap-2 px-7 py-3.5 bg-gold text-white rounded-full font-semibold text-sm shadow-lg">
                {s.cta} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1"/>
              </Link>
              <button className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/8 hover:bg-white/14 text-white/90 rounded-full font-semibold text-sm transition-all border border-white/15 backdrop-blur-sm hover:border-white/30">
                <Play size={13}/> Watch Video
              </button>
            </div>

            {/* Animated stats */}
            <div ref={statsRef} className="flex flex-wrap gap-8 mt-10 pt-8 border-t border-white/10">
              <AnimatedStat value={2500000} suffix="+" label="Customers" start={statsVisible}/>
              <AnimatedStat value={450} suffix="+" label="Branches" start={statsVisible}/>
              <AnimatedStat value={15} suffix="+" label="Years" start={statsVisible}/>
              <AnimatedStat value={99} suffix="%" label="Uptime" start={statsVisible}/>
            </div>
          </div>

          {/* Floating dashboard illustration */}
          <div className={`hidden lg:flex items-center justify-center transition-all duration-500 ${fading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <div className="relative w-full max-w-sm">
              {/* Main card */}
              <div className="bg-white/8 backdrop-blur border border-white/10 rounded-3xl p-6 animate-float shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest">Total Balance</p>
                    <p className="text-white font-serif text-2xl font-bold">Br 46,459.50</p>
                  </div>
                  <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
                    <TrendingUp size={18} className="text-gold"/>
                  </div>
                </div>
                {/* Mini chart */}
                <svg viewBox="0 0 240 60" className="w-full mb-4" aria-hidden="true">
                  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4930A" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#D4930A" stopOpacity="0"/>
                  </linearGradient></defs>
                  <path d="M0 50 C30 45 50 35 70 30 S110 15 130 10 S180 5 210 8 L240 6 L240 60 L0 60Z" fill="url(#cg)"/>
                  <path d="M0 50 C30 45 50 35 70 30 S110 15 130 10 S180 5 210 8 L240 6" fill="none" stroke="#D4930A" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="240" cy="6" r="4" fill="#D4930A"/>
                </svg>
                {/* Transactions */}
                {[
                  { n:'Salary Deposit', a:'+Br 15,200', c:'text-green-400' },
                  { n:'Shoa Supermarket', a:'-Br 875', c:'text-red-400' },
                  { n:'Transfer — Savings', a:'-Br 2,000', c:'text-red-400' },
                ].map((t,i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-t border-white/6">
                    <span className="text-white/60 text-xs">{t.n}</span>
                    <span className={`text-xs font-semibold ${t.c}`}>{t.a}</span>
                  </div>
                ))}
              </div>
              {/* Floating mini card */}
              <div className="absolute -bottom-6 -right-6 bg-gold rounded-2xl p-4 shadow-xl animate-float-x w-36">
                <p className="text-white/60 text-[9px] uppercase tracking-wide">Quick Pay</p>
                <p className="text-white font-bold text-sm mt-0.5">Ethio Telecom</p>
                <p className="text-white/70 text-xs mt-1">Br 100 ready</p>
              </div>
              {/* Notification badge */}
              <div className="absolute -top-4 -left-4 bg-white rounded-2xl px-3 py-2 shadow-xl flex items-center gap-2 animate-float-slow">
                <div className="w-2 h-2 rounded-full bg-green-400"/>
                <p className="text-primary font-semibold text-xs">Transfer Complete</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
        {SLIDES.map((_,i) => (
          <button key={i} onClick={() => { setFading(true); setTimeout(()=>{ setCur(i); setFading(false) },250) }}
            aria-label={`Slide ${i+1}`}
            className={`rounded-full transition-all duration-400 ${i===cur ? 'w-7 h-2 bg-gold' : 'w-2 h-2 bg-white/25 hover:bg-white/50'}`}/>
        ))}
      </div>
    </section>
  )
}

/* ── Quick links with hover lift ──────────────── */
function QuickLinks() {
  const links = [
    { icon:<Smartphone size={20}/>, label:'Mobile Banking', path:'/products' },
    { icon:<CreditCard size={20}/>, label:'Cards & Payments', path:'/cards' },
    { icon:<TrendingUp size={20}/>, label:'Loans', path:'/products' },
    { icon:<Building2 size={20}/>, label:'Business Banking', path:'/products' },
    { icon:<Globe size={20}/>, label:'Forex Rates', path:'/' },
    { icon:<Shield size={20}/>, label:'Security Center', path:'/security' },
  ]
  return (
    <div className="bg-white border-b border-border-light shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-border-light">
          {links.map((l,i) => (
            <Link to={l.path} key={l.label}
              className="flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-gold-faint transition-all duration-200 group text-center"
              style={{ transitionDelay:`${i*30}ms` }}>
              <div className="text-primary-muted group-hover:text-gold transition-colors group-hover:scale-110 transform duration-200">{l.icon}</div>
              <span className="text-[12px] font-semibold text-text-body group-hover:text-primary transition-colors leading-tight">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Services with tilt ───────────────────────── */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((e.clientX-r.left)/r.width -0.5)*14
    const y = ((e.clientY-r.top)/r.height -0.5)*-10
    el.style.transform=`perspective(800px) rotateY(${x}deg) rotateX(${y}deg) scale(1.02)`
    el.style.transition='transform 0.1s ease'
  }
  const onLeave = () => {
    const el = ref.current; if (!el) return
    el.style.transform='perspective(800px) rotateY(0) rotateX(0) scale(1)'
    el.style.transition='transform 0.5s ease'
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`tilt-card ${className||''}`} style={{willChange:'transform'}}>
      {children}
    </div>
  )
}

function ServicesSection() {
  const { ref, visible } = useScrollReveal()
  const cards = [
    { icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, tag:'Digital Banking', title:'Geberew Online', body:'Through our online banking platform, avoid unnecessary queues. Manage all your financial activity securely from anywhere.', dark:false },
    { icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>, tag:'Mobile First', title:'Mobile Banking', body:'Safe, secure, and flexible. Open accounts, transfer funds, and pay bills from your phone — anytime, anywhere.', dark:true },
    { icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>, tag:'Premium', title:'Apollo Digital', body:'A flexible, user-friendly platform giving you freedom to manage accounts anytime, anywhere — without visiting a branch.', dark:false },
  ]
  return (
    <section className="bg-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div ref={ref} className={`text-center mb-11 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-2">What We Offer</p>
          <h2 className="font-serif text-3xl font-bold text-primary">Our Digital Services</h2>
          <div className="w-12 h-1 bg-gold mx-auto mt-3 rounded-full"/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((c,i) => (
            <TiltCard key={c.title}>
              <div className={`rounded-2xl p-8 flex flex-col cursor-pointer transition-all duration-300 h-full
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                ${c.dark ? 'bg-primary text-white shadow-lg' : 'bg-surface border border-border-light shadow-card'}`}
                style={{ transitionDelay:`${i*120}ms` }}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300
                ${c.dark ? 'bg-white/10 text-gold' : 'bg-primary-faint text-primary'}`}>
                {c.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-gold">{c.tag}</span>
              <h3 className={`font-serif text-xl font-bold mb-3 ${c.dark ? 'text-white' : 'text-primary'}`}>{c.title}</h3>
              <p className={`text-sm leading-relaxed mb-6 flex-1 ${c.dark ? 'text-white/65' : 'text-text-muted'}`}>{c.body}</p>
              <button className={`self-start px-5 py-2.5 rounded-full text-sm font-semibold transition-all btn-magnetic
                ${c.dark ? 'bg-gold hover:bg-gold-dark text-white' : 'border-2 border-primary text-primary hover:bg-primary hover:text-white'}`}>
                Learn more
              </button>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Account tabs ─────────────────────────────── */
function AccountTabs() {
  const [tab, setTab] = useState(0)
  const { ref, visible } = useScrollReveal()
  const tabs = [
    { label:'Saving Accounts', title:"Women's Savings Account", sub:'Empowerment & Financial Freedom',
      body:"A present from us to women — open a Geberew account with higher interest rates. Discounts and ease of access to your accounts even when shopping.\n\nGeberew Bank offers increased savings rates and dedicated financial planning support for Ethiopian women.",
      badge:'7.5%', bl:'Annual Interest', g:'from-gold to-gold-dark' },
    { label:'Loan Products', title:'Personal & Business Loans', sub:'Flexible Terms, Competitive Rates',
      body:"Whether you need financing for your home, business, or personal goals, Geberew Bank offers tailored loan products with flexible repayment schedules.\n\nOur loan officers guide you from application through disbursement — quickly and transparently.",
      badge:'12%', bl:'Starting From', g:'from-primary to-primary-dark' },
    { label:'Current Accounts', title:'Business Current Account', sub:'Built for Enterprises',
      body:"Geberew Bank's current accounts are designed for businesses needing flexibility. Unlimited transactions, overdraft facilities, and dedicated relationship managers.\n\nWith our trade finance services, we support import/export operations across Ethiopia and globally.",
      badge:'0', bl:'Min. Balance', g:'from-primary-light to-primary' },
  ]
  const t = tabs[tab]
  return (
    <section className="bg-primary-faint py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex border-b border-border-light mb-10 overflow-x-auto">
          {tabs.map((tb,i) => (
            <button key={tb.label} onClick={() => setTab(i)}
              className={`flex-shrink-0 px-7 py-4 text-[13px] font-semibold border-b-2 transition-all whitespace-nowrap
                ${tab===i ? 'border-gold text-gold' : 'border-transparent text-text-muted hover:text-primary'}`}>
              {tb.label}
            </button>
          ))}
        </div>
        <div ref={ref} className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-2">{t.sub}</p>
            <h3 className="font-serif text-3xl font-bold text-primary mb-4">{t.title}</h3>
            <div className="w-10 h-1 bg-gold mb-6 rounded-full"/>
            {t.body.split('\n\n').map((p,i)=><p key={i} className="text-text-body text-sm leading-relaxed mb-4">{p}</p>)}
            <Link to="/products" className="mt-2 px-7 py-3 bg-gold hover:bg-gold-dark text-white rounded-full font-semibold text-sm transition-all shadow-md btn-magnetic inline-flex items-center gap-2">
              Learn More <ChevronRight size={14}/>
            </Link>
          </div>
          {/* Floating card with tilt */}
          <div className="flex justify-center">
            <TiltCard>
              <div className={`bg-gradient-to-br ${t.g} rounded-3xl p-8 w-72 h-44 relative shadow-2xl overflow-hidden flex flex-col justify-between`}>
                <div className="absolute inset-0 opacity-10">
                  <svg width="100%" height="100%"><defs><pattern id="tp" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M17.5 0L35 17.5L17.5 35L0 17.5Z" fill="none" stroke="white" strokeWidth="1.2"/></pattern></defs><rect width="100%" height="100%" fill="url(#tp)"/></svg>
                </div>
                <div className="relative flex justify-between items-start">
                  <div>
                    <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest">{t.bl}</p>
                    <p className="text-white text-3xl font-bold font-serif">{t.badge}</p>
                  </div>
                  <div className="bg-white/20 rounded-full px-3 py-1 text-white text-xs font-bold">Geberew</div>
                </div>
                <div className="relative">
                  <p className="text-white/50 text-xs tracking-[0.25em] font-mono">•••• •••• •••• 7823</p>
                  <p className="text-white text-sm font-semibold mt-1">A. HAILE</p>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Exchange rates ────────────────────────────── */
function ExchangeRates() {
  const { ref, visible } = useScrollReveal()
  const rates = [
    {flag:'🇺🇸',code:'USD',name:'US Dollar',buy:'55.20',sell:'56.80'},
    {flag:'🇬🇧',code:'GBP',name:'British Pound',buy:'69.80',sell:'71.60'},
    {flag:'🇪🇺',code:'EUR',name:'Euro',buy:'59.40',sell:'61.20'},
    {flag:'🇸🇦',code:'SAR',name:'Saudi Riyal',buy:'14.70',sell:'15.10'},
    {flag:'🇦🇪',code:'AED',name:'UAE Dirham',buy:'15.00',sell:'15.40'},
    {flag:'🇨🇳',code:'CNY',name:'Chinese Yuan',buy:'7.60',sell:'7.90'},
  ]
  return (
    <section className="bg-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-3">
          <div>
            <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-1">Live Rates</p>
            <h2 className="font-serif text-2xl font-bold text-primary">Exchange Rates</h2>
            <div className="w-10 h-1 bg-gold mt-2 rounded-full"/>
          </div>
          <p className="text-text-light text-xs">Indicative · Updated daily 09:00 EAT</p>
        </div>
        <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {rates.map((r,i) => (
            <div key={r.code}
              className={`bg-surface rounded-2xl p-5 border border-border-light shadow-card cursor-pointer text-center
                hover:shadow-card-hover hover:border-gold/30 hover:-translate-y-2 hover:scale-105 transition-all duration-300
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay:`${i*60}ms` }}>
              <div className="text-4xl mb-2">{r.flag}</div>
              <p className="text-[11px] text-text-muted">{r.name}</p>
              <p className="font-bold text-lg text-primary my-1">{r.code}</p>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between"><span className="text-text-light">Buy</span><span className="font-semibold text-success">{r.buy}</span></div>
                <div className="flex justify-between"><span className="text-text-light">Sell</span><span className="font-semibold text-danger">{r.sell}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Feature sections ─────────────────────────── */
function FeatureSections() {
  const { ref: r1, visible: v1 } = useScrollReveal()
  const { ref: r2, visible: v2 } = useScrollReveal()
  return (
    <section className="py-6 px-4">
      <div className="bg-primary-faint py-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-4">
          <div ref={r1} className={`transition-all duration-700 ${v1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-2">Digital Payments</p>
            <h3 className="font-serif text-3xl font-bold text-primary mb-4">Pay & Get Paid Anywhere</h3>
            <div className="w-10 h-1 bg-gold mb-6 rounded-full"/>
            <p className="text-text-body text-sm leading-relaxed mb-4">Our e-commerce payment gateway helps businesses collect payments online — securely and instantly.</p>
            <p className="text-text-body text-sm leading-relaxed mb-6">Use Geberew Visa and Mastercard to execute plans across borders with just your fingertips.</p>
            <Link to="/cards" className="px-7 py-3 bg-gold hover:bg-gold-dark text-white rounded-full font-semibold text-sm inline-flex items-center gap-2 btn-magnetic">
              Explore Cards <ChevronRight size={14}/>
            </Link>
          </div>
          <div className={`flex justify-center transition-all duration-700 delay-200 ${v1 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <TiltCard>
              <div className="bg-primary rounded-3xl p-8 w-full max-w-xs shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-5"><svg width="100%" height="100%"><defs><pattern id="fp2" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 0L40 20L20 40L0 20Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#fp2)"/></svg></div>
                <div className="relative space-y-4">
                  <div className="bg-gradient-to-br from-gold to-gold-dark rounded-2xl p-5 shadow-lg animate-float">
                    <div className="flex justify-between items-start mb-5">
                      <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Geberew Bank</div>
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-4 h-4"><path d="M1 6h22v12H1zM1 10h22"/></svg></div>
                    </div>
                    <p className="text-white/50 text-xs font-mono tracking-[0.2em]">•••• •••• •••• 4491</p>
                    <div className="flex justify-between mt-3"><p className="text-white font-bold text-sm">A. HAILE</p><p className="text-white/60 text-xs">12/27</p></div>
                  </div>
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <div className="bg-white/10 rounded-xl px-5 py-2 text-white font-black text-lg italic">VISA</div>
                    <div className="flex -space-x-2"><div className="w-8 h-8 rounded-full bg-red-500/90"/><div className="w-8 h-8 rounded-full bg-gold/90"/></div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </div>
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-4">
          <div className={`lg:order-2 transition-all duration-700 ${v2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`} ref={r2}>
            <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-2">Shari'a Compliant</p>
            <h3 className="font-serif text-3xl font-bold text-primary mb-4">Interest-Free Banking</h3>
            <div className="w-10 h-1 bg-gold mb-6 rounded-full"/>
            <p className="text-text-body text-sm leading-relaxed mb-4">Specialised Interest-Free Banking service with unique product features fully compliant with Shari'a principles.</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {['Mudarabah','Musharakah','Murabahah','Ijarah'].map(t=>(
                <span key={t} className="px-3 py-1.5 bg-primary-faint text-primary text-xs font-semibold rounded-full hover:bg-primary hover:text-white transition-all cursor-pointer">{t}</span>
              ))}
            </div>
            <Link to="/products" className="px-7 py-3 bg-primary hover:bg-primary-dark text-white rounded-full font-semibold text-sm inline-flex items-center gap-2 btn-magnetic">
              Learn More <ChevronRight size={14}/>
            </Link>
          </div>
          <div className={`lg:order-1 flex justify-center transition-all duration-700 delay-200 ${v2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <TiltCard>
              <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-10 w-full max-w-xs shadow-2xl text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-5"><svg width="100%" height="100%"><defs><pattern id="ip2" width="50" height="50" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="25" height="25" fill="none" stroke="white" strokeWidth="0.8"/></pattern></defs><rect width="100%" height="100%" fill="url(#ip2)"/></svg></div>
                <div className="relative">
                  <div className="text-gold font-serif text-2xl font-bold mb-1 animate-float">ገብረው አሜን</div>
                  <div className="text-white/50 font-serif text-base mb-4">GeberewAmeen</div>
                  <div className="w-12 h-px bg-white/20 mx-auto mb-4"/>
                  <div className="grid grid-cols-4 gap-2 justify-items-center mb-4">
                    {[...Array(8)].map((_,i)=><div key={i} className="w-5 h-5 rotate-45 bg-gold/20 border border-gold/30 hover:bg-gold/40 transition-colors cursor-pointer"/>)}
                  </div>
                  <div className="text-white/40 text-xs tracking-widest">شريعة COMPLIANT</div>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Card showcase with hover flip ────────────── */
function CardShowcase() {
  const { ref, visible } = useScrollReveal()
  const cards = [
    { label:'Classic Debit',  gradient:'from-gold to-gold-light',           id:'cl' },
    { label:'Platinum Card',  gradient:'from-primary to-primary-dark',       id:'pl' },
    { label:'Business Visa',  gradient:'from-primary-light to-primary-dark', id:'bz' },
  ]
  return (
    <section className="bg-primary-faint py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-2">Cards</p>
        <div className="flex justify-between items-end mb-8">
          <h2 className="font-serif text-2xl font-bold text-primary">Choose Your Visa Debit Card</h2>
          <Link to="/cards" className="text-gold text-sm font-semibold hover:underline flex items-center gap-1">
            View all <ArrowRight size={13}/>
          </Link>
        </div>
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {cards.map((c,i)=>(
            <Link to="/cards" key={c.label}
              className={`group block transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay:`${i*120}ms` }}>
              <div className={`bg-gradient-to-br ${c.gradient} rounded-3xl p-6 h-44 relative overflow-hidden shadow-lg
                group-hover:shadow-2xl group-hover:-translate-y-3 group-hover:rotate-1 transition-all duration-400`}>
                <div className="absolute inset-0 opacity-10"><svg width="100%" height="100%"><defs><pattern id={`csp-${c.id}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 0L40 20L20 40L0 20Z" fill="none" stroke="white" strokeWidth="1.5"/></pattern></defs><rect width="100%" height="100%" fill={`url(#csp-${c.id})`}/></svg></div>
                {/* Shine sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"/>
                <div className="relative flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start">
                    <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest">ገብረው ባንክ</div>
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-4 h-4"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                  </div>
                  <div>
                    <p className="text-white/50 font-mono text-[11px] tracking-[0.25em]">•••• •••• •••• 7823</p>
                    <div className="flex justify-between items-end mt-1.5">
                      <p className="text-white font-bold text-sm">{c.label}</p>
                      <p className="text-white/40 text-[10px]">12/27</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-between items-center px-1">
                <p className="font-semibold text-primary text-sm group-hover:text-gold transition-colors">{c.label}</p>
                <span className="text-gold text-xs font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">Apply <ArrowRight size={10}/></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Trust bar ─────────────────────────────────── */
function TrustBar() {
  const { ref, visible } = useScrollReveal()
  const items = [
    { icon:<Shield size={20}/>, label:'NBE Regulated', sub:'Full regulatory oversight' },
    { icon:<Lock size={20}/>, label:'256-bit Encryption', sub:'Military-grade security' },
    { icon:<CheckCircle2 size={20}/>, label:'Zero-Liability', sub:'Fraud protection guaranteed' },
    { icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>, label:'Rated 4.8 / 5', sub:'By 2.5M+ customers' },
  ]
  return (
    <div className="bg-primary-dark py-10 px-4">
      <div ref={ref} className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((item,i)=>(
          <div key={item.label}
            className={`flex items-center gap-3 transition-all duration-600 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ transitionDelay:`${i*100}ms` }}>
            <div className="w-10 h-10 bg-white/8 rounded-xl flex items-center justify-center flex-shrink-0 text-gold glow-pulse">{item.icon}</div>
            <div>
              <p className="font-semibold text-white text-sm">{item.label}</p>
              <p className="text-white/40 text-[11px] mt-0.5">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── News ──────────────────────────────────────── */
function NewsSection() {
  const { ref, visible } = useScrollReveal()
  const posts = [
    { cat:'Press Release', date:'25 Oct 2026', title:'Geberew Bank Launches New Digital Savings Platform', excerpt:'The new platform allows customers to open savings accounts in under 3 minutes with fully digital KYC.' },
    { cat:'Notice', date:'18 Oct 2026', title:'System Maintenance: Sunday 2 Nov, 02:00–04:00', excerpt:'Online banking services will be briefly unavailable. Mobile banking remains fully operational.' },
    { cat:'Security Alert', date:'10 Oct 2026', title:'Beware of Fraudulent Calls Claiming to be Geberew Bank', excerpt:'We will never ask for your password or verification code by phone.' },
  ]
  return (
    <section className="bg-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-1">Latest</p>
            <h2 className="font-serif text-2xl font-bold text-primary">News & Notices</h2>
            <div className="w-10 h-1 bg-gold mt-2 rounded-full"/>
          </div>
          <Link to="/news" className="text-gold text-sm font-semibold hover:underline flex items-center gap-1">All News <ChevronRight size={13}/></Link>
        </div>
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((p,i)=>(
            <article key={p.title}
              className={`bg-surface rounded-2xl border border-border-light overflow-hidden shadow-card cursor-pointer group
                hover:shadow-card-hover hover:-translate-y-2 hover:border-gold/25 transition-all duration-300
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay:`${i*90}ms` }}>
              <div className="h-1.5 bg-gradient-to-r from-primary to-gold"/>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold bg-gold-faint px-2.5 py-1 rounded-full">{p.cat}</span>
                  <span className="text-[10px] text-text-light">{p.date}</span>
                </div>
                <h3 className="font-serif font-bold text-primary text-sm mb-2 leading-snug group-hover:text-gold transition-colors">{p.title}</h3>
                <p className="text-text-muted text-xs leading-relaxed">{p.excerpt}</p>
                <button className="mt-4 text-gold text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Read more <ArrowRight size={10}/>
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── CTA ───────────────────────────────────────── */
function CTABanner() {
  const { ref, visible } = useScrollReveal()
  return (
    <section className="bg-primary py-16 px-4 text-center relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-gold/5 particle-1 pointer-events-none"/>
      <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full bg-white/3 particle-2 pointer-events-none"/>
      <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true"><svg width="100%" height="100%"><defs><pattern id="cbp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#cbp)"/></svg></div>
      <div ref={ref} className={`relative max-w-2xl mx-auto transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <p className="text-gold text-[11px] font-bold uppercase tracking-widest mb-3">Get Started Today</p>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">Start Banking the Smarter Way</h2>
        <p className="text-white/55 mb-8 text-sm leading-relaxed">Join millions of Ethiopians who trust Geberew Bank for savings, loans, and everyday banking.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/login" className="btn-magnetic ripple-btn inline-flex items-center gap-2 px-8 py-4 bg-gold text-white rounded-full font-bold text-sm shadow-lg">
            Sign In to Online Banking <ArrowRight size={14}/>
          </Link>
          <Link to="/support" className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/18 text-white rounded-full font-bold text-sm border border-white/20 transition-all backdrop-blur-sm hover:border-white/40">
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  useEffect(() => { document.title = 'Geberew Bank — Home | ገብረው ባንክ' }, [])
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <NavBar/>
      <main id="main-content" className="flex-1">
        <Hero/>
        <QuickLinks/>
        <ServicesSection/>
        <AccountTabs/>
        <ExchangeRates/>
        <FeatureSections/>
        <CardShowcase/>
        <TrustBar/>
        <NewsSection/>
        <CTABanner/>
      </main>
      <Footer/>
      <CookieNotice/>
    </div>
  )
}
