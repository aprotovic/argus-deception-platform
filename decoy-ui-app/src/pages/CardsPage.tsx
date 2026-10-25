import { useEffect, useState, useRef } from 'react'
import { NavBar } from '../components/shared/NavBar'
import { Footer } from '../components/shared/Footer'
import { useScrollReveal } from '../hooks/useScrollReveal'
import { ArrowRight, CheckCircle, Zap, Globe, Shield } from 'lucide-react'

const CARDS = [
  {
    id: 'classic',
    name: 'Classic Debit Card',
    tag: 'VISA DEBIT',
    tagline: 'Your everyday companion',
    frontGrad: ['#D4930A','#c8860a','#E8B03C'],
    backGrad:  ['#9a6508','#D4930A'],
    features: ['Free card issuance','Nationwide ATM access','Contactless payments','Daily limit Br 50,000','Accepted worldwide'],
    annualFee: 'Free',
    limit: 'Br 50,000',
    best: false,
    accentLight: true,
  },
  {
    id: 'platinum',
    name: 'Platinum Credit',
    tag: 'PREMIUM',
    tagline: 'Premium banking privileges',
    frontGrad: ['#1B2B5E','#2D4080','#3D5298'],
    backGrad:  ['#111A3D','#1B2B5E'],
    features: ['Br 200,000 credit limit','Travel insurance','Airport lounge access','0% interest 45 days','Exclusive merchant offers'],
    annualFee: 'Br 500',
    limit: 'Br 200,000',
    best: true,
    accentLight: false,
  },
  {
    id: 'business',
    name: 'Business Visa',
    tag: 'CORPORATE',
    tagline: 'Built for enterprise',
    frontGrad: ['#374151','#4B5563','#1B2B5E'],
    backGrad:  ['#1f2937','#374151'],
    features: ['Multiple cards per account','Spending reports','Corporate protection','Cash-back on purchases','Dedicated manager'],
    annualFee: 'Br 1,000',
    limit: 'Br 500,000',
    best: false,
    accentLight: false,
  },
]

function Card3D({ card, index }: { card: typeof CARDS[0]; index: number }) {
  const [flipped, setFlipped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (flipped) return
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -14
    setTilt({ x, y })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
    setHovered(false)
  }

  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 200 + 100)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
      {/* Flip hint */}
      <div className="text-center mb-3">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
          {flipped ? '↩ Click to flip back' : 'Click card to flip →'}
        </span>
      </div>

      {/* 3D scene */}
      <div className="card-scene w-full" style={{ height: '200px' }}
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={() => { setFlipped(f => !f); setTilt({ x:0, y:0 }) }}
        role="button" tabIndex={0} aria-label={`${card.name} — click to flip`}
        onKeyDown={e => e.key === 'Enter' && setFlipped(f => !f)}
      >
        <div className={`card-wrap w-full h-full relative cursor-pointer ${flipped ? 'flipped' : ''}`}
          style={{
            transform: !flipped
              ? `perspective(900px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg) scale(${hovered ? 1.04 : 1})`
              : 'perspective(900px) rotateY(180deg)',
            transition: flipped || (!hovered && tilt.x === 0)
              ? 'transform 0.7s cubic-bezier(.4,0,.2,1)'
              : 'transform 0.15s ease',
          }}>

          {/* FRONT */}
          <div className="card-face absolute inset-0 rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${card.frontGrad[0]} 0%, ${card.frontGrad[1]} 50%, ${card.frontGrad[2]} 100%)` }}>
            {/* Animated shine */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
              style={{ background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)`,
                transform: `translateX(${hovered ? '200%' : '-200%'})`,
                transition: 'transform 0.7s ease' }}/>
            {/* Pattern */}
            <div className="absolute inset-0 opacity-[0.06]">
              <svg width="100%" height="100%"><defs>
                <pattern id={`mp-${card.id}`} width="35" height="35" patternUnits="userSpaceOnUse">
                  <path d="M17.5 0L35 17.5L17.5 35L0 17.5Z" fill="none" stroke="white" strokeWidth="1"/>
                </pattern></defs>
                <rect width="100%" height="100%" fill={`url(#mp-${card.id})`}/>
              </svg>
            </div>
            {/* Orb */}
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}/>
            <div className="relative p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/50 text-[9px] tracking-[0.2em] font-bold uppercase">ገበሬው ባንክ</p>
                  <p className="text-white font-bold text-sm mt-0.5">{card.tag}</p>
                </div>
                {/* EMV Chip */}
                <div className="w-9 h-7 rounded-md relative overflow-hidden border border-white/30"
                  style={{ background: 'linear-gradient(135deg, #d4a853, #f0c97a, #b8862a)' }}>
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-[1px] p-[2px]">
                    {[...Array(6)].map((_,i)=><div key={i} className="rounded-sm bg-black/20"/>)}
                  </div>
                </div>
              </div>
              <div>
                {/* Contactless */}
                <div className="flex gap-0.5 mb-2">
                  {[8,12,16].map(r => (
                    <div key={r} className="rounded-full border border-white/30" style={{ width:r, height:r }}/>
                  ))}
                </div>
                <p className="text-white/50 font-mono text-xs tracking-[0.25em]">•••• •••• •••• 7823</p>
                <div className="flex justify-between items-end mt-2">
                  <div>
                    <p className="text-white/30 text-[8px] uppercase tracking-wide">Card Holder</p>
                    <p className="text-white text-sm font-bold">A. HAILE</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/30 text-[8px] uppercase tracking-wide">Expires</p>
                    <p className="text-white text-sm font-bold">12/28</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="card-back absolute inset-0 rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${card.backGrad[0]} 0%, ${card.backGrad[1]} 100%)` }}>
            {/* Magnetic stripe */}
            <div className="absolute top-7 left-0 right-0 h-10 bg-black/60"/>
            <div className="absolute inset-0 opacity-[0.04]">
              <svg width="100%" height="100%"><defs>
                <pattern id={`bp-${card.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="20" y2="20" stroke="white" strokeWidth="0.5"/>
                </pattern></defs>
                <rect width="100%" height="100%" fill={`url(#bp-${card.id})`}/>
              </svg>
            </div>
            <div className="relative p-5 flex flex-col justify-end h-full gap-3">
              {/* Signature strip */}
              <div className="bg-white rounded-lg px-3 py-1.5 flex justify-between items-center">
                <p className="text-gray-700 text-xs" style={{ fontFamily:'cursive' }}>A. Haile</p>
                <div className="flex gap-1">
                  {[...Array(3)].map((_,i)=><div key={i} className="w-5 h-5 bg-gray-200 rounded"/>)}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-white/30 text-[9px] tracking-wide">GEBEREW BANK S.C.</p>
                <div className="flex items-center gap-2">
                  {/* Visa */}
                  <div className="bg-white/15 rounded px-2 py-0.5">
                    <span className="text-white font-black text-xs italic tracking-tight">VISA</span>
                  </div>
                  {/* MC */}
                  <div className="flex -space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-red-500 opacity-90"/>
                    <div className="w-5 h-5 rounded-full bg-amber-400 opacity-90"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info card below */}
      <div className={`mt-5 rounded-2xl border p-5 transition-all duration-300 hover:shadow-card-hover
        ${card.best ? 'border-gold bg-gold-faint' : 'border-border-light bg-surface'}`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-serif font-bold text-primary">{card.name}</h3>
            <p className="text-text-muted text-xs mt-0.5">{card.tagline}</p>
          </div>
          {card.best && <span className="text-[10px] bg-gold text-white font-bold px-2.5 py-1 rounded-full">Best Value</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div className="bg-white rounded-xl p-2.5 border border-border-light text-center">
            <p className="text-text-muted mb-0.5">Annual Fee</p>
            <p className="font-bold text-primary">{card.annualFee}</p>
          </div>
          <div className="bg-white rounded-xl p-2.5 border border-border-light text-center">
            <p className="text-text-muted mb-0.5">Limit</p>
            <p className="font-bold text-primary">{card.limit}</p>
          </div>
        </div>
        <ul className="space-y-1.5 mb-5">
          {card.features.map(f => (
            <li key={f} className="flex items-center gap-2 text-xs text-text-body">
              <CheckCircle size={11} className="text-gold flex-shrink-0"/>{f}
            </li>
          ))}
        </ul>
        <button className={`w-full py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 btn-magnetic ripple-btn
          ${card.best ? 'bg-gold hover:bg-gold-dark text-white' : 'bg-primary hover:bg-primary-dark text-white'}`}>
          Apply Now <ArrowRight size={13}/>
        </button>
      </div>
    </div>
  )
}

function BenefitsStrip() {
  const items = [
    { icon:<Zap size={16}/>, text:'Instant activation' },
    { icon:<Globe size={16}/>, text:'Accepted worldwide' },
    { icon:<Shield size={16}/>, text:'Zero liability fraud' },
    { icon:<CheckCircle size={16}/>, text:'24/7 card support' },
    { icon:<Zap size={16}/>, text:'Contactless ready' },
    { icon:<Globe size={16}/>, text:'International transfers' },
    { icon:<Shield size={16}/>, text:'Secure chip & PIN' },
    { icon:<CheckCircle size={16}/>, text:'Real-time alerts' },
  ]
  return (
    <div className="bg-primary-dark overflow-hidden py-3 border-y border-white/5">
      <div className="flex gap-0" style={{ width: 'max-content' }}>
        <div className="marquee-track flex gap-8 pr-8">
          {[...items,...items].map((i,idx)=>(
            <div key={idx} className="flex items-center gap-2 text-white/60 text-xs whitespace-nowrap">
              <span className="text-gold">{i.icon}</span>{i.text}
              <span className="text-white/20 ml-4">◆</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CardsPage() {
  useEffect(() => { document.title = 'Cards – Geberew Bank' }, [])
  const { ref, visible } = useScrollReveal()

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar/>
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary relative overflow-hidden py-20 px-4">
          {/* Particle orbs */}
          <div className="absolute top-10 right-20 w-32 h-32 rounded-full bg-gold/10 particle-1 pointer-events-none"/>
          <div className="absolute bottom-10 left-16 w-20 h-20 rounded-full bg-white/5 particle-2 pointer-events-none"/>
          <div className="absolute top-1/2 right-1/3 w-12 h-12 rounded-full bg-gold/8 particle-3 pointer-events-none"/>
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%"><defs><pattern id="cp" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L60 30L30 60L0 30Z" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#cp)"/></svg>
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold/15 text-gold text-[11px] font-bold uppercase tracking-widest rounded-full mb-6 border border-gold/20">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"/>
              Click Any Card to Flip It
            </span>
            <h1 className="font-serif text-5xl font-bold text-white mb-4 leading-tight">
              Choose Your <span className="gradient-text">Perfect Card</span>
            </h1>
            <p className="text-white/55 max-w-xl mx-auto text-base leading-relaxed">
              Hover to tilt, click to flip and reveal the back. Find the card that fits your lifestyle.
            </p>
          </div>
        </section>

        <BenefitsStrip/>

        {/* Cards grid */}
        <section className="bg-white py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div ref={ref} className={`grid grid-cols-1 md:grid-cols-3 gap-10 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
              {CARDS.map((c, i) => <Card3D key={c.id} card={c} index={i}/>)}
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  )
}
