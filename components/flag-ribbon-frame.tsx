'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// The ribbon's sixty-odd fluttering flags keep a phone's main thread busy a
// quarter of the time, so taps wait behind them — and the strip sits below
// the fold on every screen size. It's still in the server HTML and only
// moves while it's (nearly) on screen.
export function FlagRibbonFrame({ label, style, children }: { label: string; style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    const section = ref.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: '100px 0px' })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} aria-label={label} className="flag-ribbon torn-top bg-collage-blue" style={style} data-offscreen={onScreen ? undefined : ''}>
      {children}
    </section>
  )
}
