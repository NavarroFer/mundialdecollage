'use client'

import { useRef } from 'react'
import { AnimatedNumber } from '@/components/animated-number'
import { useLiveHomeStats } from '@/components/use-live-home-stats'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

// Starts from the totals the page was built with and follows new
// publications while it's on screen (components/use-live-home-stats.ts).
export function AnimatedParticipationProof(initial: { artworks: number; countries: number }) {
  const { locale, m } = useI18n()
  const ref = useRef<HTMLParagraphElement>(null)
  const live = useLiveHomeStats(ref)
  const { artworks, countries } = live ?? initial
  return (
    <p ref={ref} className="mt-5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-base font-semibold text-ink sm:text-lg">
      <span>{m.hero.proof.split('{artworks}')[0]}</span>
      <span className="text-collage-red"><AnimatedNumber value={artworks} /> {plural(locale, artworks, m.map.artworks).replace(/^\S+\s/, '')}</span>
      <span>{m.hero.proof.split('{artworks}')[1]?.split('{countries}')[0]}</span>
      <span className="text-collage-blue"><AnimatedNumber value={countries} /> {plural(locale, countries, m.hero.countries).replace(/^\S+\s/, '')}</span>
    </p>
  )
}
