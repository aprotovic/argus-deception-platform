import { useTranslation } from '../../i18n/useTranslation'
const icons = {
  checking: <path d="M3 22h18M2 6h20v14a1 1 0 01-1 1H3a1 1 0 01-1-1V6zM12 6V2M8 2h8M7 10v8M12 10v8M17 10v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  savings: <><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-2c0-.4 0-1.2.5-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="17" cy="5" r="3" stroke="currentColor" strokeWidth="2"/></>,
  mortgage: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></>,
  business: <><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="2"/><line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2"/></>,
}
const products = ['checking','savings','mortgage','business'] as const
export function ProductSection() {
  const { t } = useTranslation()
  return (
    <section className="bg-surface py-16 px-4 sm:px-6" id="services" aria-labelledby="products-heading">
      <div className="max-w-7xl mx-auto">
        <h2 id="products-heading" className="font-serif text-2xl sm:text-3xl font-bold text-navy text-center mb-2">{t('landing.products.title')}</h2>
        <p className="text-text-muted text-center mb-10 max-w-xl mx-auto">{t('landing.products.subtitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(p => (
            <div key={p} className="bg-white rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow group cursor-pointer">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors text-primary">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">{icons[p]}</svg>
              </div>
              <h3 className="font-semibold text-navy mb-2">{t(`landing.products.${p}.name`)}</h3>
              <p className="text-text-muted text-sm leading-relaxed mb-4">{t(`landing.products.${p}.desc`)}</p>
              <span className="text-primary text-sm font-medium group-hover:underline">{t('landing.products.learnMore')} →</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
