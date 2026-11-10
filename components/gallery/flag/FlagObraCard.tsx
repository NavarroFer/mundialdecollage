'use client'

import { ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { imageSrc } from '@/lib/image-src'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { useFlagStore } from './store'

/**
 * The obra a visitor clicked on the hall's flag: its picture, its title and
 * artist, and a way to its own page, which opens in a new tab so the visit
 * is still there when they come back.
 */
export function FlagObraCard({ theme }: { theme: GalleryTheme }) {
  const entry = useFlagStore((state) => state.entry)
  const { m } = useI18n()
  const close = () => useFlagStore.getState().close()
  if (!entry?.slug) return null
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-ink/25 backdrop-blur-[1px]"
        className={cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden, 'flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm flex-col gap-3 overflow-y-auto p-5')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the same CDN-cached thumbnail the flag was drawn from */}
        <img src={imageSrc(entry.imageUrl, 640)} alt={entry.title ?? ''} className="max-h-[48dvh] w-full rounded object-contain" />
        <DialogTitle className="font-display text-2xl tracking-tight uppercase">{entry.title}</DialogTitle>
        {entry.name && <p className="text-sm font-semibold">{entry.name}</p>}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/obras/${encodeURIComponent(entry.slug)}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-collage-yellow px-5 py-2.5 text-sm font-semibold text-ink"
          >
            {m.gallery.viewArtwork}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <button type="button" onClick={close} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold">
            {m.gallery.wall.close}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
