'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { formatNumber } from '@/lib/i18n/format'
import { afterSplash } from '@/lib/splash'

// Ticks up the last stretch to `value` the first time it scrolls into view,
// waiting for the home's splash to clear so it doesn't play unseen behind it.
// Starting near the total keeps the run short and readable.
const START_RATIO = 0.8

export function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const { locale } = useI18n()
  const ref = useRef<HTMLSpanElement>(null)
  const start = Math.floor(value * START_RATIO)
  const [shown, setShown] = useState(start)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    let cancelWait = () => {}
    const countUp = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setShown(value)
        return
      }
      const startedAt = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        setShown(Math.round(start + (value - start) * (1 - (1 - progress) ** 3)))
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      cancelWait = afterSplash(countUp)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelWait()
      cancelAnimationFrame(frame)
    }
  }, [value, start, duration])

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
