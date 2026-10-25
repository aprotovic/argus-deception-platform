import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BankLogo } from './BankLogo'
import { useTranslation } from '../../i18n/useTranslation'
import { ChevronDown, Menu, X, Search, User, Phone } from 'lucide-react'

const NAV = [
  { label: 'Home', path: '/' },
  { label: 'About Us', path: '/about' },
  {
    label: 'Products & Services', path: '/products',
    children: [
      { label: 'All Products',            path: '/products' },
      { label: 'Personal Accounts',       path: '/products' },
      { label: 'Business Accounts',       path: '/products' },
      { label: 'Loans',                   path: '/products' },
      { label: 'Cards',                   path: '/cards' },
      { label: 'Digital Banking',         path: '/products' },
      { label: 'Interest-Free Banking',   path: '/products' },
    ]
  },
  { label: 'Branches & ATMs', path: '/branches' },
  { label: 'News & Media',    path: '/news' },
  { label: 'Contact Us',      path: '/support' },
]

export function NavBar() {
  const { lang, setLang } = useTranslation()
  const [mobile, setMobile] = useState(false)
  const [search, setSearch] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const { pathname } = useLocation()

  const isActive = (path: string) => pathname === path

  return (
    <>
      {/* ── Utility bar ── */}
      <div className="hidden md:block bg-primary text-white/55 text-[11px]">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-8">
          <div className="flex items-center gap-2">
            <Phone size={10} className="text-gold"/>
            <span>+251 11 000 0000 · Mon–Fri 08:00–17:00</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/security" className="hover:text-white transition-colors">Security Tips</Link>
            <Link to="/investor" className="hover:text-white transition-colors">Investor Relations</Link>
            <button onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
              className="hover:text-gold font-medium transition-colors tracking-wide">
              {lang === 'en' ? 'አማርኛ' : 'English'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main nav ── */}
      <nav className="bg-white sticky top-0 z-40 border-b border-border-light shadow-[0_2px_12px_rgba(27,43,94,0.08)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-[64px] gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <BankLogo size={38}/>
              <div className="leading-tight">
                <div className="font-bold text-primary text-sm tracking-tight group-hover:text-gold transition-colors">
                  {lang === 'am' ? 'ገብረው ባንክ' : 'Geberew Bank'}
                </div>
                <div className="text-[10px] text-text-muted">
                  {lang === 'am' ? 'ወደፊት ከናንተ ጋር' : 'Forward Together With You'}
                </div>
              </div>
            </Link>

            {/* Desktop links */}
            <div className="hidden lg:flex items-center flex-1 ml-2">
              {NAV.map(item => (
                <div key={item.label} className="relative group">
                  <Link to={item.path}
                    className={`flex items-center gap-1 px-3.5 py-5 text-[13px] font-medium whitespace-nowrap transition-colors
                      border-b-2 border-transparent hover:border-gold hover:text-gold
                      ${isActive(item.path) ? 'text-gold border-gold' : 'text-text-body'}`}>
                    {item.label}
                    {item.children && (
                      <ChevronDown size={11} className="opacity-50 group-hover:opacity-100 transition-transform duration-200 group-hover:rotate-180"/>
                    )}
                  </Link>
                  {item.children && (
                    <div className="absolute top-full left-0 bg-white shadow-card-hover border border-border-light rounded-2xl w-56 pt-2 pb-2
                      opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
                      transition-all duration-200 z-50">
                      {item.children.map(c => (
                        <Link key={c.label} to={c.path}
                          className="flex items-center px-4 py-2.5 text-[13px] text-text-body hover:bg-primary-faint hover:text-primary transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold/40 mr-2.5 flex-shrink-0"/>
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right */}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setSearch(s => !s)}
                className="hidden md:flex w-9 h-9 items-center justify-center rounded-full text-text-muted hover:bg-primary-faint hover:text-primary transition-colors">
                <Search size={16}/>
              </button>
              <Link to="/login"
                className="hidden md:inline-flex items-center gap-2 h-10 px-5 bg-gold hover:bg-gold-dark text-white rounded-full font-semibold text-[13px] transition-all shadow-sm hover:shadow-md active:scale-[0.97]">
                <User size={13}/> Sign In
              </Link>
              <button onClick={() => setMobile(m => !m)}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-faint text-text-body transition-colors">
                {mobile ? <X size={20}/> : <Menu size={20}/>}
              </button>
            </div>
          </div>

          {/* Search bar */}
          {search && (
            <div className="pb-3 animate-fade-in">
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"/>
                <input autoFocus value={searchVal} onChange={e => setSearchVal(e.target.value)}
                  placeholder="Search products, services, branches…"
                  className="w-full bg-surface border border-border-light rounded-full pl-10 pr-5 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition"/>
              </div>
            </div>
          )}
        </div>

        {/* Mobile drawer */}
        {mobile && (
          <div className="lg:hidden border-t border-border-light animate-fade-in bg-white">
            {NAV.map(item => (
              <Link key={item.label} to={item.path} onClick={() => setMobile(false)}
                className={`flex items-center justify-between px-5 py-3.5 text-[13px] font-medium border-b border-border-light last:border-0 transition-colors
                  ${isActive(item.path) ? 'text-gold bg-gold-faint' : 'text-text-body hover:bg-primary-faint hover:text-primary'}`}>
                {item.label}
                {item.children && <ChevronDown size={12} className="text-text-muted"/>}
              </Link>
            ))}
            <div className="p-4">
              <Link to="/login" onClick={() => setMobile(false)}
                className="flex justify-center items-center gap-2 w-full py-3 bg-gold hover:bg-gold-dark text-white rounded-full font-semibold text-sm transition-all">
                <User size={14}/> Sign In to Online Banking
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
