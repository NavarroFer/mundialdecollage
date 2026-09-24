import { Globe2 } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { WorldMap } from '@/components/world-map-lazy'
import { countryCodeToFlag, countryCodeToName, guessCountryCodeFromName } from '@/lib/participants'
import { getFinalists } from '@/lib/finalists'
import stats from '@/data/artist-country-stats.json'
import { getI18n } from '@/lib/i18n/server'

type CountryCount = { country: string; countryCode?: string; count: number }

// The homepage and admin statistics share the same curated source of truth.
// Composite or missing country labels stay in the ranking but are not painted
// on a single country in the map.
const breakdown: CountryCount[] = stats.countries.map(({ country, count }) => ({
  country,
  count,
  countryCode: guessCountryCodeFromName(country),
}))

export async function MapSection() {
  const [artworks, { locale, m }] = await Promise.all([getFinalists(), getI18n()])

  return (
    <section
      id="mapa"
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
            <WorldMap
              breakdown={breakdown.flatMap(({ countryCode, count }) =>
                countryCode ? [{ countryCode, count }] : [],
              )}
              artworks={artworks}
            />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {m.map.legend}
            </p>
          </div>
        </FadeIn>
      )}

      <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
        <FadeIn delay={300}>
          {breakdown.length > 0 ? (
            <ul className="mt-12 space-y-3">
              {breakdown.map(({ country, countryCode, count }, i) => (
                <li
                  key={country}
                  className="flex items-center justify-between gap-4 rounded-2xl border-2 border-ink/10 bg-background px-5 py-3"
                >
                  <span className="flex items-center gap-3 font-medium text-ink">
                    <span className="text-sm text-muted-foreground">
                      #{i + 1}
                    </span>
                    {countryCode && (
                      <span aria-hidden className="text-xl">
                        {countryCodeToFlag(countryCode)}
                      </span>
                    )}
                    {/* Registro's labels are Spanish; recognisable countries get the reader's name for them. */}
                    {countryCode ? countryCodeToName(countryCode, locale) : country}
                  </span>
                  <span className="rounded-full bg-collage-blue px-3 py-1 text-sm font-bold text-primary-foreground">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-muted-foreground">
              {m.map.empty}
            </p>
          )}
        </FadeIn>
      </div>
    </section>
  )
}
