interface Props { className?: string; size?: number; light?: boolean }
export function BankLogo({ className = '', size = 36, light = false }: Props) {
  const star = light ? '#FFFFFF' : '#D4930A'
  const bg   = light ? 'rgba(255,255,255,0.15)' : '#1B2B5E'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="20" fill={bg}/>
      {/* Eight-pointed star — Ethiopian motif */}
      <path d="M20 6 L22.5 17.5 L34 20 L22.5 22.5 L20 34 L17.5 22.5 L6 20 L17.5 17.5 Z" fill={star}/>
      <circle cx="20" cy="20" r="3" fill={light ? 'rgba(255,255,255,0.4)' : '#D4930A'} opacity="0.9"/>
    </svg>
  )
}
