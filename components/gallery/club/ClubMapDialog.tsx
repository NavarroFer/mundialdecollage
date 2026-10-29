'use client'

import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/client'
import { goToClubGallery, useClubDoorStore } from './store'

// The map and its shapes load only when a visitor opens it.
const ClubMap = dynamic(() => import('@/components/club/club-map').then((m) => m.ClubMap), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted sm:aspect-[40/21]" aria-hidden />,
})

// The Club's map from inside a gallery: every house, this one marked as
// «you are here», and the way into any other (the same CDN list as the door).
export function ClubMapDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const open = useClubDoorStore((state) => state.mapOpen)
  const galleries = useClubDoorStore((state) => state.galleries)
  const { m } = useI18n()
  const t = m.gallery.clubMap
  const here = galleries.find((gallery) => gallery.slug === slug)?.coordinates ?? null
  const others = galleries.filter((gallery) => gallery.slug !== slug)

  return (
    <Dialog open={open} onOpenChange={(next) => { useClubDoorStore.getState().setMapOpen(next); if (!next) onClose() }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto bg-paper p-4 sm:p-6">
        <DialogTitle className="font-display text-2xl uppercase">{t.title}</DialogTitle>
        {others.some((gallery) => gallery.coordinates) || here ? (
          <ClubMap
            houses={others}
            picked={here}
            texts={{ enter: t.enter, hint: t.hint, close: t.close, yourHouse: t.here }}
            onEnter={goToClubGallery}
            initialCenter={here ?? undefined}
            initialZoom={here ? 3 : 1}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
