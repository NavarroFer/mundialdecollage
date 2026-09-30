'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setShown(value)
        return
      }
      const startedAt = performance.now()
      const duration = 900
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        setShown(Math.round(value * (1 - (1 - progress) ** 3)))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [value])

  return <span ref={ref}>{shown}</span>
}

export function AnimatedParticipationProof({ artworks, countries }: { artworks: number; countries: number }) {
  const { locale, m } = useI18n()
  return (
    <p className="mt-5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-base font-semibold text-ink sm:text-lg">
      <span>{m.hero.proof.split('{artworks}')[0]}</span>
      <span className="text-collage-red"><AnimatedNumber value={artworks} /> {plural(locale, artworks, m.map.artworks).replace(/^\S+\s/, '')}</span>
      <span>{m.hero.proof.split('{artworks}')[1]?.split('{countries}')[0]}</span>
      <span className="text-collage-blue"><AnimatedNumber value={countries} /> {plural(locale, countries, m.hero.countries).replace(/^\S+\s/, '')}</span>
    </p>
  )
}
