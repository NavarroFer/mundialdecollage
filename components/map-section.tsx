import { Globe2 } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { WorldMap } from '@/components/world-map-lazy'
import { countByCountry } from '@/lib/country-breakdown'
import { getFinalists } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'
import { MAP_SECTION_ID } from '@/lib/map-country-link'

export async function MapSection() {
  const [artworks, { m }] = await Promise.all([getFinalists(), getI18n()])
  // Live from the database: the same published obras the map opens when a
  // country is tapped (getFinalists only returns ones with a country).
  const breakdown = countByCountry(artworks.map((artwork) => artwork.countryCode)).flatMap(
    ({ countryCode, count }) => (countryCode ? [{ countryCode, count }] : []),
  )

  return (
    <section
      id={MAP_SECTION_ID}
      className="relative overflow-hidden border-t-2 border-ink/10 bg-card py-20 sm:py-28"
    >
      <Globe2
        className="pointer-events-none absolute -top-14 -left-10 h-56 w-56 text-collage-blue/10 sm:h-72 sm:w-72"
        strokeWidth={1}
      />

      <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
            {m.map.eyebrow}
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="font-display mt-5 rotate-1 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
            <span className="torn-strip inline-block bg-collage-yellow px-4 py-1">
              {m.map.title}
            </span>
          </p>
        </FadeIn>
      </div>

      {breakdown.length > 0 && (
        <FadeIn delay={200}>
          <div className="relative mx-auto mt-12 max-w-4xl px-5 sm:px-8">
            <WorldMap breakdown={breakdown} artworks={artworks} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {m.map.legend}
            </p>
          </div>
        </FadeIn>
      )}

      {breakdown.length === 0 && (
        <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
          <FadeIn delay={300}>
            <p className="mt-8 text-center text-muted-foreground">
              {m.map.empty}
            </p>
          </FadeIn>
        </div>
      )}
    </section>
  )
}
