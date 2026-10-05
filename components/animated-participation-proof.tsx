'use client'

import { AnimatedNumber } from '@/components/animated-number'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

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
