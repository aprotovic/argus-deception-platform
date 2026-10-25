import React, { useEffect, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
interface Props {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  titleId?: string
}
export function Modal({ isOpen, onClose, title, children, titleId = 'modal-title' }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const el = ref.current
    if (el) el.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }} aria-modal="true" role="dialog" aria-labelledby={titleId}>
      <div ref={ref} tabIndex={-1} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in focus:outline-none">
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="font-serif text-lg font-bold text-navy">{title}</h2>
          <button onClick={onClose} aria-label={t('aria.closeModal')} className="p-2 rounded hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
