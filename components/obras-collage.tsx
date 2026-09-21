import Link from 'next/link'
import type { Finalist } from '@/lib/finalists'
import './obras-collage.css'

export function ObrasCollage({ finalists }: { finalists: Finalist[] }) {
  return (
    <div className="obras-collage">
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Un mundo de recortes. Tocá una obra para descubrirla.
      </p>
      <ul className="obras-collage__stage" aria-label="Obras participantes">
        {finalists.map((artwork) => (
          <li key={artwork.slug} className="obras-collage__item">
            <Link
              href={`/obras/${artwork.slug}`}
              className="obras-collage__window"
              aria-label={`${artwork.artworkTitle}, de ${artwork.name}. Ver obra`}
            >
              <span className="obras-collage__bar" aria-hidden="true">
                <i /><i /><i />
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
