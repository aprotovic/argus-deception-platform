import { useEffect, useState, useRef } from 'react'

export function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  const frame = useRef<number>(0)

  useEffect(() => {
    if (!start) return
    const startTime = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, start])

  return count
}
