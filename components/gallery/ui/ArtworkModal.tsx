'use client'

import Image from 'next/image'
import type { Artwork } from '@/data/artworks'
import { useInteractionStore } from '../interaction/store'

export function ArtworkModal({ artworks }: { artworks: Artwork[] }) {
  const openId = useInteractionStore((state) => state.openId)
  const artwork = artworks.find((item) => item.id === openId)

  if (!artwork) return null

  return (
    <div className="animate-in fade-in absolute inset-0 flex items-center justify-center bg-ink/85 p-6 backdrop-blur-sm duration-200">
      <div className="animate-in fade-in zoom-in-95 grid max-h-full w-full max-w-4xl gap-6 overflow-y-auto rounded-2xl bg-paper p-6 shadow-2xl duration-200 sm:grid-cols-2 sm:p-8">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-card">
          <Image
            src={artwork.image}
            alt={artwork.title}
            fill
            sizes="(min-width: 640px) 40vw, 90vw"
            className="object-contain"
          />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <p className="font-display text-2xl leading-tight text-ink">{artwork.title}</p>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">
            {artwork.artist} · {artwork.year}
          </p>
          <p className="text-base leading-relaxed text-ink/80">{artwork.description}</p>
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            E para cerrar · ESC para salir de la exposición
          </p>
        </div>
      </div>
    </div>
  )
}
