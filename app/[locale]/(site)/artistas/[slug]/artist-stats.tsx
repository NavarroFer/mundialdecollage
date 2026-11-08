'use client'

import { useI18n } from '@/lib/i18n/client'
import { formatNumber, plural } from '@/lib/i18n/format'
import { useArtistSocial } from './use-artist-social'

// The row of counters under the artist's name, as on an Instagram profile:
// obras (known with the page), likes and comments (arrive after it).
export function ArtistStats({ slug, artworkCount }: { slug: string; artworkCount: number }) {
  const { locale, m } = useI18n()
  const social = useArtistSocial(slug)
  const t = m.artistProfile

  const stats = [
    { value: artworkCount, label: t.statArtworks },
    { value: social?.totals.likes, label: t.statLikes },
    { value: social?.totals.comments, label: t.statComments },
  ]

  return (
    <ul className="flex gap-6 sm:gap-10" aria-busy={social === undefined}>
      {stats.map(({ value, label }, i) => (
        <li key={i} className="text-center sm:text-left">
          <span className="block font-display text-2xl leading-none text-ink tabular-nums sm:inline sm:text-xl">
            {value === undefined ? (
              // Same width as a short number, so the row doesn't jump.
              <span className="inline-block h-5 w-6 animate-pulse rounded bg-muted align-middle motion-reduce:animate-none" aria-hidden />
            ) : (
              formatNumber(locale, value)
            )}
          </span>{' '}
          <span className="text-sm font-semibold text-muted-foreground sm:text-base">
            {plural(locale, value ?? 0, label)}
          </span>
        </li>
      ))}
    </ul>
  )
}
