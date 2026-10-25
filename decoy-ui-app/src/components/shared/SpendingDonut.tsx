import { useTranslation } from '../../i18n/useTranslation'
interface Segment { label: string; pct: number; color: string; key: string }
interface Props { segments: Segment[] }
export function SpendingDonut({ segments }: Props) {
  const { t } = useTranslation()
  const R = 70, CX = 90, CY = 90, SW = 44
  const circ = 2 * Math.PI * R
  let offset = 0
  const slices = segments.map(s => {
    const len = (s.pct / 100) * circ
    const dasharray = `${len} ${circ - len}`
    const dashoffset = -(offset)
    offset += len
    return { ...s, dasharray, dashoffset }
  })
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 180 180" width="160" height="160" role="img" aria-label={t('dashboard.spending.title')} className="flex-shrink-0">
        <title>{t('dashboard.spending.title')}</title>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth={SW}/>
        {slices.map((s, i) => (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={SW}
            strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
            transform={`rotate(-90 ${CX} ${CY})`}/>
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f2044" fontFamily="'Playfair Display',serif">{t('dashboard.spending.subtitle').split(' ')[0]}</text>
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f2044" fontFamily="'Playfair Display',serif">{t('dashboard.spending.subtitle').split(' ').slice(1).join(' ')}</text>
      </svg>
      <div className="flex flex-col gap-2 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} aria-hidden="true"/>
            <span className="text-text-dark">{t(`dashboard.spending.${s.key}`)}</span>
            <span className="text-text-muted ml-1">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
