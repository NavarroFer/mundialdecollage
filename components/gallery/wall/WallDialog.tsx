'use client'

import { useEffect, useState } from 'react'
import { Heart, ImagePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { placeWallPiece } from '@/app/galeria-3d/wall-actions'
import { MAX_LIVES, timeUntil, WALL_BUCKET, type WallLives } from '@/lib/collage-wall'
import { galleryWallReturnPath } from '@/lib/gallery-return'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { wallPhoto, type WallPhoto } from './photo'
import { loadWall, useWallStore } from './store'

type Picked = WallPhoto & { url: string }

/** Paste a photo on the collective collage, right where the visitor was looking (E on the frame). */
export function WallDialog({ theme }: { theme: GalleryTheme }) {
  const placing = useWallStore((state) => state.placing)
  if (!placing) return null
  // Keyed by the spot, so each opening starts clean.
  return <WallDialogContent key={`${placing.x},${placing.y}`} theme={theme} point={placing} />
}

function WallDialogContent({ theme, point }: { theme: GalleryTheme; point: { x: number; y: number } }) {
  const { locale, m } = useI18n()
  const t = m.gallery.wall
  const { lives, userId, loaded, available } = useWallStore()
  const [picked, setPicked] = useState<Picked | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => track('wall_open'), [])
  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url)
  }, [picked])

  const close = () => useWallStore.getState().close()

  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    const photo = await wallPhoto(file)
    if (!photo) {
      setError(t.errors.unreadable)
      return
    }
    setPicked({ ...photo, url: URL.createObjectURL(photo.blob) })
  }

  async function paste() {
    if (!picked || !userId || busy) return
    setBusy(true)
    setError('')
    try {
      const path = `${userId}/${crypto.randomUUID()}.${picked.extension}`
      const { error: uploadError } = await createClient().storage.from(WALL_BUCKET).upload(path, picked.blob, { contentType: picked.blob.type })
      if (uploadError) throw new Error(uploadError.message)
      const result = await placeWallPiece({ path, ...point })
      if ('error' in result) {
        if (result.lives) useWallStore.getState().setLives(result.lives)
        if (result.error === 'no_lives') track('wall_no_lives')
        else setError(t.errors.failed)
        return
      }
      useWallStore.getState().added(result.piece, result.lives)
      track('wall_piece_placed')
      setDone(true)
    } catch {
      setError(t.errors.failed)
    } finally {
      setBusy(false)
    }
  }

  async function signIn() {
    setBusy(true)
    track('wall_sign_in')
    await startGoogleSignIn(galleryWallReturnPath(point))
  }

  const outOfLives = lives !== null && !lives.unlimited && lives.lives < 1
  const button = 'inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold disabled:opacity-60'

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-ink/25 backdrop-blur-[1px]"
        className={cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden, 'flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-md flex-col gap-4 overflow-y-auto p-6')}
      >
        <DialogTitle className="font-display text-2xl tracking-tight uppercase">{t.title}</DialogTitle>

        {!loaded ? (
          <p role="status" className="text-sm text-muted-foreground">…</p>
        ) : !available ? (
          <p role="alert" className="text-sm">{t.errors.unavailable}</p>
        ) : done ? (
          <p role="status" className="text-sm font-semibold">{t.done}</p>
        ) : !userId ? (
          <>
            <p className="text-sm">{t.intro}</p>
            <p className="text-sm font-semibold">{t.signIn}</p>
            <button type="button" onClick={() => void signIn()} disabled={busy} className={cn(button, 'self-start bg-white text-ink')}>
              <GoogleIcon />{t.signInButton}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm">{t.intro}</p>
            {lives && <Lives lives={lives} t={t} locale={locale} />}
            {!outOfLives && (
              <>
                {picked && (
                  // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing to optimize
                  <img src={picked.url} alt={t.previewAlt}
                    className={cn('max-h-[32dvh] w-auto self-center', picked.extension === 'jpg' ? 'rounded-sm border-8 border-white shadow-md' : 'drop-shadow-md')} />
                )}
                <div className="flex flex-wrap gap-2">
                  <label className={cn(button, 'cursor-pointer', !picked && 'bg-collage-yellow text-ink')}>
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    {picked ? t.change : t.pick}
                    <input type="file" accept="image/*" className="sr-only" disabled={busy}
                      onChange={(event) => void pick(event.target.files?.[0])} />
                  </label>
                  {picked && (
                    <button type="button" onClick={() => void paste()} disabled={busy} className={cn(button, 'bg-collage-yellow text-ink')}>
                      {busy ? t.pasting : t.paste}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t.review}</p>
              </>
            )}
          </>
        )}

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" onClick={close} className={cn(button, 'self-start')}>{t.close}</button>
      </DialogContent>
    </Dialog>
  )

}

type WallMessages = ReturnType<typeof useI18n>['m']['gallery']['wall']

function Lives({ lives, t, locale }: { lives: WallLives; t: WallMessages; locale: ReturnType<typeof useI18n>['locale'] }) {
  const now = useNow()
  const next = !lives.unlimited && lives.nextLifeAt && lives.lives < MAX_LIVES ? timeUntil(lives.nextLifeAt, now) : null
  const lifeBack = next !== null && next.hours === 0 && next.minutes === 0
  // A life just came back: ask again rather than trusting the clock.
  useEffect(() => {
    if (lifeBack) void loadWall()
  }, [lifeBack])

  if (lives.unlimited) return <p className="text-sm font-semibold">{t.unlimited}</p>
  const time = next && !lifeBack && (next.hours > 0 ? fmt(t.hoursMinutes, next) : fmt(t.minutes, next))
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1" aria-label={plural(locale, lives.lives, t.lives)}>
        {Array.from({ length: MAX_LIVES }, (_, index) => (
          <Heart key={index} aria-hidden="true" className={cn('h-5 w-5', index < lives.lives ? 'fill-collage-red text-collage-red' : 'text-ink/30')} />
        ))}
        <span className="ml-2 text-sm font-semibold">{lives.lives < 1 ? t.noLives : plural(locale, lives.lives, t.lives)}</span>
      </p>
      {time && <p className="text-sm">{fmt(t.nextLife, { time })}</p>}
      <p className="text-xs text-muted-foreground">{t.livesHelp}</p>
    </div>
  )
}

// Ticks every 30 seconds, for the "next life in…" countdown.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
