import { useTranslation } from '../../i18n/useTranslation'
const branches = ['bole','piassa','megenagna','kazanchis'] as const
export function BranchFinder() {
  const { t } = useTranslation()
  return (
    <section className="py-12 px-4 sm:px-6 bg-surface" id="branches" aria-labelledby="branches-heading">
      <div className="max-w-7xl mx-auto">
        <h2 id="branches-heading" className="font-serif text-2xl font-bold text-navy text-center mb-2">{t('landing.branches.title')}</h2>
        <p className="text-text-muted text-center text-sm mb-8">{t('landing.branches.subtitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {branches.map(b => (
            <div key={b} className="bg-white rounded-xl p-5 shadow-card border-l-4 border-primary">
              <div className="flex items-center gap-2 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B2B5E" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="font-semibold text-navy text-sm">{t(`landing.branches.${b}.name`)}</span>
              </div>
              <p className="text-text-muted text-xs leading-relaxed">{t(`landing.branches.${b}.address`)}</p>
              <p className="text-primary text-xs font-medium mt-1">{t(`landing.branches.${b}.hours`)}</p>
              <span className="inline-block mt-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{t('landing.branches.type.branch')}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
