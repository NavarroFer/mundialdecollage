'use client'

import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, Camera, Check, Compass, Eye, LockKeyhole, Scissors, Send } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { Artwork } from '@/data/artworks'
import { exhibitionDay } from '@/lib/exhibition-day'
import { imageSrc } from '@/lib/image-src'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'
import { STAMP_KEYS, type StampKey } from '@/lib/stamps'
import { cn } from '@/lib/utils'
import { usePassportStore } from '../passport/store'
import { useGalleryPreferences } from '../preferences/store'
import { useSouvenirStore } from '../souvenir/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'

/** Writes the visit into the passport: today's exhibition once walked, and each souvenir photo. */
export function PassportRecorder({ userId, started }: { userId: string; started: boolean }) {
  useEffect(() => { usePassportStore.getState().hydrate(userId) }, [userId])
  useEffect(() => {
    if (started) usePassportStore.getState().recordDay(exhibitionDay())
  }, [started])
  useEffect(() => useSouvenirStore.subscribe((state, previous) => {
    if (state.open && !previous.open) usePassportStore.getState().recordPhoto()
  }), [])
  return null
}

type ArtworkStampRow = { slug: string; title: string; image: string; artist: string }
type Stamps = { unlocked: StampKey[]; artworks: ArtworkStampRow[] }

const badgeIcons: Record<StampKey, typeof Send> = { first: Send, gallery: Scissors, world: Compass }

// The album's stamps live on the server (/api/stamps, private to the
// account): read when the passport opens, not on every visit.
function useStamps(open: boolean) {
  const [stamps, setStamps] = useState<Stamps | 'loading' | 'error'>('loading')
  useEffect(() => {
    if (!open) return
    let current = true
    fetch('/api/stamps', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { unlockedStamps?: StampKey[]; artworkStamps?: ArtworkStampRow[] }) => {
        if (current) setStamps({ unlocked: data.unlockedStamps ?? [], artworks: data.artworkStamps ?? [] })
      })
      .catch(() => { if (current) setStamps('error') })
    return () => { current = false }
  }, [open])
  return stamps
}

/**
 * The visit passport: the obras discovered (today's, as stamps to collect,
 * and all-time), the exhibition days walked, the souvenir photos, and the
 * album's stamps — the same ones as on the home page.
 */
export function Passport({ artworks, theme, onClose, onResume }: { artworks: Artwork[]; theme: GalleryTheme; onClose: () => void; onResume: (id: string) => void }) {
  const open = usePassportStore((state) => state.open)
  const days = usePassportStore((state) => state.days)
  const photos = usePassportStore((state) => state.photos)
  const visited = useGalleryPreferences((state) => state.visited)
  const stamps = useStamps(open)
  const { locale, m } = useI18n()
  const t = m.gallery.passport

  if (!open) return null

  const close = () => {
    usePassportStore.getState().setOpen(false)
    onClose()
  }
  const discoveredToday = artworks.filter((artwork) => visited.includes(artwork.id)).length

  return (
    <Dialog open onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent
        aria-describedby="gallery-passport-intro"
        overlayClassName="bg-ink/40 backdrop-blur-[2px]"
        className={cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden, 'flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-5 overflow-y-auto p-5 sm:p-7')}
      >
        <header>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] uppercase opacity-70"><BookOpen className="h-4 w-4" aria-hidden="true" /> {m.gallery.startEyebrow}</p>
          <DialogTitle className="font-display mt-1 text-3xl leading-tight text-ink uppercase">{t.title}</DialogTitle>
          <p id="gallery-passport-intro" className="mt-1 text-sm">{t.intro}</p>
        </header>

        <ul className={styles.passportSeals}>
          <li><Eye aria-hidden="true" /><span>{plural(locale, visited.length, t.discovered)}</span></li>
          <li><CalendarDays aria-hidden="true" /><span>{plural(locale, days.length, t.days)}</span></li>
          <li><Camera aria-hidden="true" /><span>{plural(locale, photos, t.photos)}</span></li>
        </ul>

        <section aria-labelledby="gallery-passport-today">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="gallery-passport-today" className="font-display text-xl uppercase">{t.today}</h3>
            <p className="text-sm font-semibold">{fmt(t.todayCount, { count: discoveredToday, total: artworks.length })}</p>
          </div>
          {discoveredToday === 0 && <p className="mt-1 text-sm">{t.todayEmpty}</p>}
          <ul className={styles.passportGrid}>
            {artworks.map((artwork, index) => (
              <li key={artwork.id}>
                {visited.includes(artwork.id) ? (
                  <button type="button" className={styles.passportStamp} onClick={() => { usePassportStore.getState().setOpen(false); onResume(artwork.id) }} aria-label={fmt(t.openAgain, { title: artwork.title })} title={artwork.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the 384px copy the map explorer already caches at the CDN */}
                    <img src={imageSrc(artwork.image, 384)} alt="" loading="lazy" decoding="async" />
                    <Check className={styles.passportCheck} aria-hidden="true" />
                  </button>
                ) : (
                  <span className={cn(styles.passportStamp, styles.passportStampEmpty)} role="img" aria-label={t.undiscovered}>{index + 1}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="gallery-passport-stamps">
          <h3 id="gallery-passport-stamps" className="font-display text-xl uppercase">{t.stamps}</h3>
          {stamps === 'loading' ? (
            <p role="status" className="mt-2 text-sm opacity-70">{t.loading}</p>
          ) : stamps === 'error' ? (
            <p role="alert" className="mt-2 text-sm">{t.stampsError}</p>
          ) : (
            <>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {STAMP_KEYS.map((key) => {
                  const Icon = badgeIcons[key]
                  const unlocked = stamps.unlocked.includes(key)
                  return (
                    <li key={key} className={cn(styles.passportBadge, !unlocked && 'opacity-55 saturate-0')}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <span className="font-bold">{m.stamps[key].title}</span>
                      {unlocked ? <Check className="h-4 w-4" aria-label={t.unlocked} /> : <LockKeyhole className="h-4 w-4" aria-label={m.stamps.locked} />}
                    </li>
                  )
                })}
              </ul>
              {stamps.artworks.length ? (
                <ul className={cn(styles.passportGrid, 'mt-3')}>
                  {stamps.artworks.map((stamp) => (
                    <li key={stamp.slug} className={styles.passportStamp} title={`${stamp.title} · ${stamp.artist}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- same CDN copy as above */}
                      <img src={imageSrc(stamp.image, 384)} alt={`${stamp.title} · ${stamp.artist}`} loading="lazy" decoding="async" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm">{t.stampsEmpty}</p>
              )}
            </>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-4">
          <p className="text-xs opacity-70">{t.local}</p>
          <button type="button" onClick={close} className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-collage-yellow px-5 font-semibold text-ink">{t.close}</button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
