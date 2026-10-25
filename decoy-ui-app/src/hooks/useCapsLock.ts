import { useState, useEffect } from 'react'
export function useCapsLock(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const h = (e: KeyboardEvent) => setOn(e.getModifierState('CapsLock'))
    document.addEventListener('keydown', h)
    document.addEventListener('keyup', h)
    return () => { document.removeEventListener('keydown', h); document.removeEventListener('keyup', h) }
  }, [])
  return on
}
