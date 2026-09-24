'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Finalist } from '@/lib/finalists'
import { countryCodeToFlag } from '@/lib/participants'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import './obras-collage.css'

export function ObrasCollage({
  finalists,
  animateEntrance = false,
  showHint = true,
  ariaLabel,
}: {
  finalists: Finalist[]
  animateEntrance?: boolean
  showHint?: boolean
  ariaLabel?: string
}) {
  const { m } = useI18n()
  return (
    <div className={`obras-collage${animateEntrance ? ' obras-collage--entering' : ''}`}>
      {showHint && (
        <p className="obras-collage__hint text-center text-sm text-muted-foreground">
          <span className="obras-collage__hint-desktop">{m.collage.hintDesktop}</span>
          <span className="obras-collage__hint-touch">{m.collage.hintTouch}</span>
        </p>
      )}
      <ul className="obras-collage__stage" aria-label={ariaLabel ?? m.collage.label}>
        {finalists.map((artwork, index) => (
          <li
            key={artwork.slug}
            className="obras-collage__item"
            style={{
              '--stack-order': index + 1,
              '--entrance-delay': `${Math.min(index * 35, 280)}ms`,
            } as CSSProperties}
          >
            <Link
              href={`/obras/${artwork.slug}`}
              className="obras-collage__window"
              aria-label={fmt(m.collage.viewArtwork, { title: artwork.artworkTitle, name: artwork.name })}
            >
              <span className="obras-collage__bar" aria-hidden="true">
                <span className="obras-collage__flag">{countryCodeToFlag(artwork.countryCode)}</span>
                <span className="obras-collage__artist">{artwork.name}</span>
                <span className="obras-collage__arrow">↗</span>
              </span>
              {/* Preserve the complete artwork, including portrait and landscape formats. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artwork.imageUrl}
                alt={artwork.artworkTitle}
                width={400}
                height={440}
                loading="lazy"
                decoding="async"
                className="obras-collage__image"
              />
              <span className="obras-collage__caption">{artwork.artworkTitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
