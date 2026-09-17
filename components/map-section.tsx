import { Globe2 } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { countryCodeToFlag, participants } from '@/lib/participants'

// Spanish display name for a handful of countries likely to show up in
// lib/participants.ts. Not a full ISO-3166 database on purpose — codes
// without an entry here just fall back to showing the raw code.
const countryNames: Record<string, string> = {
  AR: 'Argentina',
  MX: 'México',
  ES: 'España',
  US: 'Estados Unidos',
  CO: 'Colombia',
  CL: 'Chile',
  PE: 'Perú',
  UY: 'Uruguay',
  PY: 'Paraguay',
  BO: 'Bolivia',
  EC: 'Ecuador',
  VE: 'Venezuela',
  BR: 'Brasil',
  CR: 'Costa Rica',
  PA: 'Panamá',
  GT: 'Guatemala',
  DO: 'República Dominicana',
  CU: 'Cuba',
  IT: 'Italia',
  FR: 'Francia',
}

function countryName(countryCode: string) {
  return countryNames[countryCode] ?? countryCode
}

type CountryCount = { countryCode: string; count: number }

// Groups the real participants array by country and sorts descending by
// count. Everything here is derived from lib/participants.ts — nothing
// fabricated.
function getCountryBreakdown(): CountryCount[] {
  const counts = new Map<string, number>()
  for (const p of participants) {
    const code = p.countryCode.toUpperCase()
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count)
}

export function MapSection() {
  const breakdown = getCountryBreakdown()

  return (
    <section className="relative overflow-hidden border-t-2 border-ink/10 bg-card py-20 sm:py-28">
      <Globe2
        className="pointer-events-none absolute -top-14 -left-10 h-56 w-56 text-collage-blue/10 sm:h-72 sm:w-72"
        strokeWidth={1}
      />

      <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
            Mapa del Mundial
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="font-display mt-5 rotate-1 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
            <span className="torn-strip inline-block bg-collage-yellow px-4 py-1">
              De dónde viene la comunidad
            </span>
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          {breakdown.length > 0 ? (
            <ul className="mt-12 space-y-3">
              {breakdown.map(({ countryCode, count }, i) => (
                <li
                  key={countryCode}
                  className="flex items-center justify-between gap-4 rounded-2xl border-2 border-ink/10 bg-background px-5 py-3"
                >
                  <span className="flex items-center gap-3 font-medium text-ink">
                    <span className="text-sm text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span aria-hidden className="text-xl">
                      {countryCodeToFlag(countryCode)}
                    </span>
                    {countryName(countryCode)}
                  </span>
                  <span className="rounded-full bg-collage-blue px-3 py-1 text-sm font-bold text-primary-foreground">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-muted-foreground">
              El mapa se arma solo a medida que lleguen las primeras obras — todavía no
              hay ninguna.
            </p>
          )}
        </FadeIn>
      </div>
    </section>
  )
}
