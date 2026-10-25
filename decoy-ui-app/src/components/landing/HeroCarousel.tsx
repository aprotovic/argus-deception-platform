import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'

const slides = [
  { n: 1, gradient: 'from-primary to-primary-dark', shape: 'M0 0 L400 0 L300 300 L0 300 Z' },
  { n: 2, gradient: 'from-navy to-primary-dark', shape: 'M100 0 L400 0 L400 300 L0 300 Z' },
  { n: 3, gradient: 'from-primary-dark to-navy', shape: 'M0 0 L400 100 L400 300 L0 300 Z' },
]

export function HeroCarousel() {
  const { t } = useTranslation()
  const [cur, setCur] = useState(0)
  useEffect(() => { const id = setInterval(() => setCur(c => (c + 1) % slides.length), 5000); return () => clearInterval(id) }, [])
  const s = slides[cur]
  return (
    <section className={`relative bg-gradient-to-br ${s.gradient} text-white overflow-hidden`} aria-label="Hero" aria-live="polite">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg viewBox="0 0 400 300" className="w-full h-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <path d={s.shape} fill="#D4930A"/>
          <circle cx="350" cy="50" r="80" fill="#1B2B5E" opacity="0.5"/>
          <circle cx="50" cy="250" r="60" fill="#D4930A" opacity="0.3"/>
        </svg>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28">
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 max-w-2xl transition-all duration-500">
          {t(`landing.hero${s.n}.title`)}
        </h1>
        <p className="text-white/80 text-base sm:text-lg max-w-xl mb-8 leading-relaxed transition-all duration-500">
          {t(`landing.hero${s.n}.subtitle`)}
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 bg-gold hover:bg-gold-dark text-white rounded font-semibold text-sm transition-colors shadow-lg focus-visible:ring-2 focus-visible:ring-white">
          {t(`landing.hero${s.n}.cta`)}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
        {/* Dots */}
        <div className="flex gap-2 mt-8" role="tablist" aria-label="Slides">
          {slides.map((_, i) => (
            <button key={i} role="tab" aria-selected={i === cur} aria-label={`${t('aria.currentSlide')} ${i+1} ${t('aria.slideOf')} ${slides.length}`}
              onClick={() => setCur(i)}
              className={`h-2 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-white ${i === cur ? 'w-8 bg-gold' : 'w-2 bg-white/40'}`}
            />
          ))}
        </div>
      </div>
      {/* Prev/Next */}
      <button onClick={() => setCur(c => (c - 1 + slides.length) % slides.length)} aria-label={t('aria.prevSlide')}
        className="absolute left-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button onClick={() => setCur(c => (c + 1) % slides.length)} aria-label={t('aria.nextSlide')}
        className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </section>
  )
}
