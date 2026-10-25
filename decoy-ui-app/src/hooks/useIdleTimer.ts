import { useEffect, useRef } from 'react'
const WARN_MS = 4 * 60 * 1000
const LOGOUT_MS = 5 * 60 * 1000
export function useIdleTimer(onWarn: () => void, onLogout: () => void) {
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reset = () => {
    if (warnRef.current) clearTimeout(warnRef.current)
    if (logoutRef.current) clearTimeout(logoutRef.current)
    warnRef.current = setTimeout(onWarn, WARN_MS)
    logoutRef.current = setTimeout(onLogout, LOGOUT_MS)
  }
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => document.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => document.removeEventListener(e, reset))
      if (warnRef.current) clearTimeout(warnRef.current)
      if (logoutRef.current) clearTimeout(logoutRef.current)
    }
  }, [])
}
