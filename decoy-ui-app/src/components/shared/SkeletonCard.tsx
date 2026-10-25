interface Props { height?: string; className?: string }
export function SkeletonCard({ height = 'h-24', className = '' }: Props) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${height} ${className}`} aria-hidden="true" />
}
