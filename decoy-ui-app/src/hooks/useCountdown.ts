import { useState, useEffect, useRef } from 'react'
export function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial)
  const [running, setRunning] = useState(false)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const start = () => { setSeconds(initial); setRunning(true) }
  const reset = () => { if (ref.current) clearInterval(ref.current); setSeconds(initial); setRunning(false) }
  useEffect(() => {
    if (!running) return
    ref.current = setInterval(() => {
      setSeconds(s => { if (s <= 1) { clearInterval(ref.current!); setRunning(false); return 0 } return s - 1 })
    }, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])
  return { seconds, isRunning: running, start, reset }
}
