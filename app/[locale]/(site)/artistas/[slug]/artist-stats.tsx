'use client'

import { useI18n } from '@/lib/i18n/client'
import { formatNumber, plural } from '@/lib/i18n/format'
import { useArtistSocial } from './use-artist-social'

// Three stickers stuck next to the name: obras (known with the page), likes
// and comments (they arrive after it). Paper with ink on any colour field, so
// the contrast never depends on which field the artist got.
const TILTS = ['-rotate-2', 'rotate-1', '-rotate-1']

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
    <ul className="flex flex-wrap gap-3" aria-busy={social === undefined}>
      {stats.map(({ value, label }, i) => (
        <li
          key={i}
          className={`${TILTS[i]} flex min-h-11 items-baseline gap-1.5 rounded-full bg-paper px-4 py-2 text-ink shadow-[0_6px_10px_-6px_rgb(27_17_12/0.5)]`}
        >
          <span className="font-display text-2xl leading-none tabular-nums">
            {value === undefined ? (
              // Same width as a short number, so the row doesn't jump.
              <span className="inline-block h-5 w-6 rounded bg-muted align-middle motion-safe:animate-pulse" aria-hidden />
            ) : (
              formatNumber(locale, value)
            )}
          </span>
          <span className="text-sm font-bold">{plural(locale, value ?? 0, label)}</span>
        </li>
      ))}
    </ul>
  )
}
