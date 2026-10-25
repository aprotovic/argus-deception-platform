import { Link } from 'react-router-dom'
import { BankLogo } from './BankLogo'
import { useTranslation } from '../../i18n/useTranslation'
import { Facebook, Twitter, Linkedin, Instagram, MapPin, Phone, Mail, Clock } from 'lucide-react'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="bg-primary-dark text-white" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BankLogo size={36} light/>
              <div>
                <div className="font-bold text-white text-sm">{t('brand.name')}</div>
                <div className="text-[10px] text-white/40 tracking-wide">{t('brand.tagline')}</div>
              </div>
            </div>
            <p className="text-white/40 text-xs leading-relaxed mb-5">{t('brand.nbe')}. Serving Ethiopia with reliable, accessible, and secure banking services.</p>
            <div className="space-y-2 text-xs text-white/40">
              <div className="flex items-start gap-2"><MapPin size={11} className="mt-0.5 flex-shrink-0 text-gold"/>{t('brand.address')}</div>
              <div className="flex items-center gap-2"><Phone size={11} className="flex-shrink-0 text-gold"/>{t('brand.phone')}</div>
              <div className="flex items-center gap-2"><Mail size={11} className="flex-shrink-0 text-gold"/>{t('brand.email')}</div>
              <div className="flex items-center gap-2"><Clock size={11} className="flex-shrink-0 text-gold"/>Mon–Fri 08:00–17:00</div>
            </div>
            <div className="flex gap-2 mt-5">
              {[Twitter, Facebook, Linkedin, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 bg-white/6 hover:bg-gold rounded-full flex items-center justify-center transition-colors">
                  <Icon size={13}/>
                </a>
              ))}
            </div>
          </div>
          {/* Personal */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Personal Banking</h3>
            <ul className="space-y-2.5">
              {['Checking Accounts','Savings Accounts','Credit Cards','Personal Loans','Mobile Banking','Online Banking'].map(l => (
                <li key={l}><Link to="/" className="text-white/50 hover:text-gold text-xs transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-gold transition-colors flex-shrink-0"/>
                  {l}
                </Link></li>
              ))}
            </ul>
          </div>
          {/* Business */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Business & Services</h3>
            <ul className="space-y-2.5">
              {['Business Accounts','Trade Finance','Payroll Services','Merchant POS','Wire Transfers','Interest-Free Banking'].map(l => (
                <li key={l}><Link to="/" className="text-white/50 hover:text-gold text-xs transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-gold transition-colors flex-shrink-0"/>
                  {l}
                </Link></li>
              ))}
            </ul>
          </div>
          {/* Help */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4 pb-2 border-b border-white/8">Help & Support</h3>
            <ul className="space-y-2.5">
              {[['Contact Us','/support'],['FAQs','/support'],['Forgot Password','/recover'],['Branch Locator','/'],['Security Tips','/'],['Accessibility','/']].map(([l,p])=>(
                <li key={l}><Link to={p} className="text-white/50 hover:text-gold text-xs transition-colors flex items-center gap-2 group">
                  <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-gold transition-colors flex-shrink-0"/>
                  {l}
                </Link></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/6 bg-black/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-white/30 text-xs">{t('brand.nbe')} · {t('brand.copyright')}</p>
          <div className="flex gap-4">
            {['Privacy Policy','Terms of Service','Cookie Policy'].map(l=>(
              <Link key={l} to="/" className="text-white/30 hover:text-white/60 text-xs transition-colors">{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
