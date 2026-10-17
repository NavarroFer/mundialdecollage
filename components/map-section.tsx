import { Globe2 } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { WorldMap } from '@/components/world-map-lazy'
import { countByCountry } from '@/lib/country-breakdown'
import { getFinalists } from '@/lib/finalists'
import { flagSvgsFor } from '@/lib/flag-svg'
import { getI18n } from '@/lib/i18n/server'
import { MAP_SECTION_ID } from '@/lib/map-country-link'
import { getSubmissionsCount } from '@/lib/submissions'
import { formatNumber } from '@/lib/i18n/format'

export async function MapSection() {
  const [artworks, submissionsCount, { locale, m }] = await Promise.all([getFinalists(), getSubmissionsCount(), getI18n()])
  // Live from the database: the same published obras the map opens when a
  // country is tapped (getFinalists only returns ones with a country; the
  // map fetches those from /api/obras itself).
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
          <div className="relative mx-auto mt-12 w-full max-w-[1600px] px-3 sm:px-6 lg:px-8">
            <div className="relative border-2 border-ink/25 bg-paper p-2 shadow-[4px_4px_0_var(--color-ink)] sm:p-5 sm:shadow-[8px_8px_0_var(--color-ink)]">
              <span aria-hidden className="pointer-events-none absolute -top-3 left-6 h-6 w-16 -rotate-6 bg-collage-yellow/80 sm:left-12 sm:w-24" />
              <WorldMap
                breakdown={breakdown}
                flags={flagSvgsFor(breakdown.map(({ countryCode }) => countryCode))}
              />
            </div>
          </div>
          <div className="relative mx-auto mt-8 max-w-4xl px-5 text-center sm:px-8">
            <p className="text-sm text-muted-foreground">
              {m.map.legend}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {formatNumber(locale, artworks.length)} / {formatNumber(locale, submissionsCount)} obras recibidas ubicadas por país
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
