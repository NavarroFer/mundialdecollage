/* Covers come from the obras' storage, through lib/image-src.ts like the map's cards. */
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { CountryFlag } from '@/components/country-flag'
import { getClubSamples } from '@/lib/club-samples'
import { flagSvgsFor } from '@/lib/flag-svg'
import { imageSrc, imageSrcSet } from '@/lib/image-src'
import { getI18n } from '@/lib/i18n/server'
import { plural } from '@/lib/i18n/format'

// The sample galleries on /club. Part of its anonymous copy (lib/static-pages.ts),
// so it reads cached public data and the locale through getI18n() only.
// Nothing shows until an admin marks one in /admin/club.
export async function ClubSamplesSection() {
  const samples = await getClubSamples()
  if (samples.length === 0) return null
  const { locale, m } = await getI18n()
  const t = m.clubLanding
  const flags = flagSvgsFor(samples.flatMap((sample) => (sample.countryCode ? [sample.countryCode] : [])))

  return (
    <section className="mt-16" aria-labelledby="club-samples-title">
      <h2 id="club-samples-title" className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{t.samplesTitle}</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t.samplesBody}</p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {samples.map((sample) => (
          <li key={sample.slug}>
            <Link href={`/club/${sample.slug}`} className="group block overflow-hidden rounded-3xl border-2 border-ink/10 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-collage-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue">
              <div className="aspect-[4/3] bg-muted">
                {sample.coverUrl && (
                  <img src={imageSrc(sample.coverUrl, 640)} srcSet={imageSrcSet(sample.coverUrl, 828)} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {sample.countryCode && <CountryFlag countryCode={sample.countryCode} svg={flags[sample.countryCode]} />}
                  {sample.artistName}
                </p>
                <h3 className="font-display mt-1 text-xl leading-tight text-ink uppercase">{sample.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plural(locale, sample.obras, m.map.artworks)}</p>
                <span className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-bold text-white">{t.samplesEnter}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
