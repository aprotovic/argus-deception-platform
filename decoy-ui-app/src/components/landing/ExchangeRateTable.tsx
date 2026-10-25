import { useTranslation } from '../../i18n/useTranslation'
const rates = [
  { pair: 'ETB/USD', buy: '55.20', sell: '56.80' },
  { pair: 'ETB/EUR', buy: '59.40', sell: '61.20' },
  { pair: 'ETB/GBP', buy: '69.80', sell: '71.60' },
  { pair: 'ETB/AED', buy: '15.00', sell: '15.40' },
]
export function ExchangeRateTable() {
  const { t } = useTranslation()
  return (
    <section className="py-12 px-4 sm:px-6 bg-white" aria-labelledby="rates-heading">
      <div className="max-w-3xl mx-auto">
        <h2 id="rates-heading" className="font-serif text-2xl font-bold text-navy text-center mb-2">{t('landing.rates.title')}</h2>
        <p className="text-text-muted text-center text-sm mb-6">{t('landing.rates.subtitle')}</p>
        <div className="overflow-x-auto rounded-xl border border-border-light shadow-card">
          <table className="min-w-full text-sm" aria-label={t('landing.rates.title')}>
            <thead className="bg-primary text-white">
              <tr>
                <th className="py-3 px-4 text-left font-semibold">{t('landing.rates.currency')}</th>
                <th className="py-3 px-4 text-right font-semibold">{t('landing.rates.buy')}</th>
                <th className="py-3 px-4 text-right font-semibold">{t('landing.rates.sell')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {rates.map(r => (
                <tr key={r.pair} className="hover:bg-surface transition-colors">
                  <td className="py-3 px-4 font-medium text-navy">{r.pair}</td>
                  <td className="py-3 px-4 text-right text-success font-medium">{r.buy}</td>
                  <td className="py-3 px-4 text-right text-danger font-medium">{r.sell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-muted text-xs text-center mt-3">{t('landing.rates.updated')}: 25 Oct 2026 09:00</p>
      </div>
    </section>
  )
}
