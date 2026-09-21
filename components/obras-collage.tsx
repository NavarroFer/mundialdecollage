import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Finalist } from '@/lib/finalists'
import './obras-collage.css'

export function ObrasCollage({ finalists }: { finalists: Finalist[] }) {
  return (
    <div className="obras-collage">
      <p className="obras-collage__hint text-center text-sm text-muted-foreground">
        <span className="obras-collage__hint-desktop">Rozá una punta: esa obra sube al frente.</span>
        <span className="obras-collage__hint-touch">Tocá una obra para descubrirla.</span>
      </p>
      <ul className="obras-collage__stage" aria-label="Obras participantes">
        {finalists.map((artwork, index) => (
          <li
            key={artwork.slug}
            className="obras-collage__item"
            style={{ '--stack-order': index + 1 } as CSSProperties}
          >
            <Link
              href={`/obras/${artwork.slug}`}
              className="obras-collage__window"
              aria-label={`${artwork.artworkTitle}, de ${artwork.name}. Ver obra`}
            >
              <span className="obras-collage__bar" aria-hidden="true">
                <span>{artwork.name}</span>
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
