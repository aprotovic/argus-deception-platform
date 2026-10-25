import { useTranslation } from '../../i18n/useTranslation'
const notices = ['notice1','notice2','notice3'] as const
export function NewsSection() {
  const { t } = useTranslation()
  return (
    <section className="py-12 px-4 sm:px-6 bg-white" aria-labelledby="news-heading">
      <div className="max-w-7xl mx-auto">
        <h2 id="news-heading" className="font-serif text-2xl font-bold text-navy text-center mb-8">{t('landing.news.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {notices.map(n => (
            <article key={n} className="bg-surface rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow border border-border-light">
              <time className="text-xs text-gold font-semibold uppercase tracking-wide">{t(`landing.news.${n}.date`)}</time>
              <h3 className="font-serif font-bold text-navy mt-2 mb-3 leading-snug">{t(`landing.news.${n}.title`)}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{t(`landing.news.${n}.excerpt`)}</p>
              <button className="mt-4 text-primary text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-gold rounded">
                {t('landing.news.readMore')} →
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
