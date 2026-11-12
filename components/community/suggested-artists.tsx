'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { suggestedArtists } from '@/app/[locale]/(site)/comunidad/actions'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'
import { countryCodeToFlag } from '@/lib/participants'
import type { SuggestedArtist } from '@/lib/community'
import { track } from '@/lib/track'

// «Artistas que te pueden gustar». The caller only mounts it when the visitor
// has a taste, so the question to the database happens once and only then.
export function SuggestedArtists() {
  const { m } = useI18n()
  const [artists, setArtists] = useState<SuggestedArtist[]>([])
  useEffect(() => {
    let gone = false
    suggestedArtists().then((list) => { if (!gone) setArtists(list) }).catch(() => {})
    return () => { gone = true }
  }, [])
  if (!artists.length) return null
  return (
    <section className="mt-8" aria-label={m.community.suggestedTitle}>
      <h2 className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{m.community.suggestedTitle}</h2>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {artists.map((artist) => (
          <li key={artist.href} className="w-36 shrink-0">
            <Link
              href={artist.obraHref}
              onClick={() => track('community_suggestion_click')}
              className="block overflow-hidden rounded-2xl border-2 border-ink/10 bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(artist.imageUrl, 320)} alt={fmt(m.community.photoOf, { name: artist.name })} className="aspect-[4/5] w-full object-cover" />
            </Link>
            <Link
              href={artist.href}
              onClick={() => track('community_suggestion_click')}
              className="mt-2 block truncate text-sm font-semibold text-ink hover:underline focus-visible:outline-2 focus-visible:outline-collage-blue"
            >
              {artist.countryCode ? `${countryCodeToFlag(artist.countryCode)} ` : ''}{artist.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
