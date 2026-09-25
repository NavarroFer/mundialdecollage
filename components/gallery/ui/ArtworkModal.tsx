'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { track } from '@/lib/track'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ArtworkLike } from './ArtworkLike'
import { ArtworkComments } from './ArtworkComments'
import { ArtworkViewers } from './PresenceCounter'
import { LiveReactions } from './LiveReactions'
import type { Artwork } from '@/data/artworks'
import { useInteractionStore } from '../interaction/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'

export function ArtworkModal({ artworks, theme }: { artworks: Artwork[]; theme: GalleryTheme }) {
  const openId = useInteractionStore((state) => state.openId)
  const artwork = artworks.find((item) => item.id === openId)
  const { m } = useI18n()

  useEffect(() => {
    if (openId) track('artwork_open')
  }, [openId])

  if (!artwork) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) useInteractionStore.getState().close() }}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-ink/25 backdrop-blur-[1px]"
        className={cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden, 'flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-6 overflow-y-auto p-6 sm:left-auto sm:right-6 sm:w-[min(25rem,calc(100%-3rem))] sm:max-w-md sm:translate-x-0 sm:p-8')}
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-card sm:hidden">
          <Image
            src={artwork.image}
            alt={artwork.title}
            fill
            sizes="(min-width: 640px) 40vw, 90vw"
            className="object-contain"
          />
        </div>
        <div className="flex min-w-0 shrink-0 flex-col justify-center gap-3">
          <DialogTitle className="font-display text-2xl leading-tight text-ink">{artwork.title}</DialogTitle>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">
            {artwork.artist} · {artwork.year}
          </p>
          <p className="text-base leading-relaxed text-ink/80">{artwork.description}</p>
          <ArtworkViewers artworkId={artwork.id} />
          <LiveReactions artworkId={artwork.id} />
          <ArtworkLike key={artwork.id} slug={artwork.id} />
          <ArtworkComments key={`comments-${artwork.id}`} slug={artwork.id} />
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {m.gallery.closeToContinue}
          </p>
          <Link href="/" onClick={() => track('home_from_gallery')} className="text-sm font-semibold underline">{m.gallery.homeLink}</Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
