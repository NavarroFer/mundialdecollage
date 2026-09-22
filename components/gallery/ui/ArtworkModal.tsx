'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ArtworkLike } from './ArtworkLike'
import type { Artwork } from '@/data/artworks'
import { useInteractionStore } from '../interaction/store'

export function ArtworkModal({ artworks }: { artworks: Artwork[] }) {
  const openId = useInteractionStore((state) => state.openId)
  const artwork = artworks.find((item) => item.id === openId)

  useEffect(() => {
    if (openId && document.pointerLockElement) document.exitPointerLock()
  }, [openId])

  if (!artwork) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) useInteractionStore.getState().close() }}>
      <DialogContent aria-describedby={undefined} className="grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl gap-6 overflow-y-auto bg-paper p-6 sm:grid-cols-2 sm:p-8">
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
          <DialogTitle className="font-display text-2xl leading-tight text-ink">{artwork.title}</DialogTitle>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">
            {artwork.artist} · {artwork.year}
          </p>
          <p className="text-base leading-relaxed text-ink/80">{artwork.description}</p>
          <ArtworkLike key={artwork.id} slug={artwork.id} />
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Cerrá esta ventana para seguir recorriendo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
