'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { formatNumber } from '@/lib/i18n/format'

// Counts up from 0 to `value` the first time it scrolls into view.
export function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const { locale } = useI18n()
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setShown(value)
        return
      }
      const startedAt = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        setShown(Math.round(value * (1 - (1 - progress) ** 3)))
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, duration])

  // The final value sits invisibly underneath so the box is sized for it
  // from the start and doesn't grow digit by digit while counting.
  return (
    <span ref={ref} className="inline-grid justify-items-center tabular-nums">
      <span className="sr-only">{formatNumber(locale, value)}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1">{formatNumber(locale, value)}</span>
      <span aria-hidden className="col-start-1 row-start-1">{formatNumber(locale, shown)}</span>
    </span>
  )
}
