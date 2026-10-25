import React from 'react'
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean; children: React.ReactNode
}
export function LoadingButton({ loading, children, className='', disabled, ...rest }: Props) {
  return (
    <button {...rest} disabled={loading||disabled}
      className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] ${className}`}>
      {loading && (
        <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  )
}
