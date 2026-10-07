'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Download, Share2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useInteractionStore } from '../interaction/store'
import { composeSouvenir, SOUVENIR_SIZE } from '../souvenir/compose'
import { useSouvenirStore } from '../souvenir/store'
import { canvasFonts } from '../fonts'
import { useWallStore } from '../wall/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { cn } from '@/lib/utils'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'

const FILE_NAME = 'mundial-de-collage.jpg'
const DOMAIN = 'mundialdecollage.com.ar'

type Photo = { blob: Blob; url: string; canShare: boolean }

let bannerPromise: Promise<HTMLImageElement> | null = null
function loadBanner() {
  bannerPromise ??= new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      bannerPromise = null
      reject(new Error('banner'))
    }
    image.src = '/banner-mundial.png'
  })
  return bannerPromise
}

/**
 * A photo of what the visitor is looking at, ready for Instagram stories:
 * the camera button, or F while walking. Taking it lets go of the mouse so
 * the preview can be used; closing it with a click takes the walk back.
 */
export function Souvenir({ theme, isTouchDevice, onResume, inline = false }: { theme: GalleryTheme; isTouchDevice: boolean; onResume: () => void; inline?: boolean }) {
  const { locale, m } = useI18n()
  const t = m.gallery.souvenir
  const open = useSouvenirStore((state) => state.open)
  const artworkOpen = useInteractionStore((state) => state.openId !== null)
  const wallOpen = useWallStore((state) => state.placing !== null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [failed, setFailed] = useState(false)
  const wasLocked = useRef(false)
  const busy = useRef(false)

  const take = useCallback(async () => {
    const { capture, setOpen } = useSouvenirStore.getState()
    if (!capture || busy.current || useSouvenirStore.getState().open || useInteractionStore.getState().openId || useWallStore.getState().placing) return
    busy.current = true
    // Shot first, while the view is exactly what the visitor framed.
    const shot = capture()
    wasLocked.current = document.pointerLockElement !== null
    if (wasLocked.current) document.exitPointerLock()
    setFailed(false)
    setOpen(true)
    track('souvenir_photo')
    try {
      if (!shot) throw new Error('capture')
      const fonts = canvasFonts(locale === 'ru')
      const headline = t.headline.toUpperCase()
      await Promise.all([document.fonts.load(`96px ${fonts.display}`, headline), document.fonts.load(`700 40px ${fonts.body}`)])
      const card = composeSouvenir(shot, await loadBanner(), {
        badge: t.badge,
        headline,
        caption: fmt(t.caption, { date: formatDayMonth(locale, new Date().toISOString()) }),
        domain: DOMAIN,
      }, fonts)
      const blob = card && await new Promise<Blob | null>((resolve) => card.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('encode')
      const file = new File([blob], FILE_NAME, { type: 'image/jpeg' })
      setPhoto({ blob, url: URL.createObjectURL(blob), canShare: navigator.canShare?.({ files: [file] }) ?? false })
    } catch {
      setFailed(true)
    } finally {
      busy.current = false
    }
  }, [locale, t])

  // F takes the photo while walking — not while typing a comment or reading an obra.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'KeyF' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      const element = document.activeElement
      if (element instanceof HTMLElement && (element.matches('input, textarea, select') || element.isContentEditable)) return
      if (document.pointerLockElement === null) return
      void take()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [take])

  function close(resume: boolean) {
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto(null)
    setFailed(false)
    useSouvenirStore.getState().setOpen(false)
    if (resume && wasLocked.current) onResume()
    wasLocked.current = false
  }

  async function share() {
    if (!photo) return
    track('souvenir_share')
    try {
      await navigator.share({
        files: [new File([photo.blob], FILE_NAME, { type: 'image/jpeg' })],
        text: `${t.shareText} ${window.location.origin}/galeria-3d`,
      })
    } catch {
      // Closing the share sheet rejects too — nothing to report.
    }
  }

  return (
    <>
      {!artworkOpen && !wallOpen && !open && (
        <button
          type="button"
          onClick={() => void take()}
          aria-label={t.button}
          title={isTouchDevice ? t.button : `${t.button} (F)`}
          className={`${styles.hudButton} animate-in fade-in absolute top-4 left-16 z-20 flex h-10 w-10 items-center justify-center duration-300 transition-transform hover:scale-105`}
        >
          <Camera className="h-5 w-5" aria-hidden="true" />
          {/* While walking the mouse is captured, so on a computer the key is the way in. */}
          {!isTouchDevice && <kbd aria-hidden="true" className="absolute -right-1.5 -bottom-1.5 rounded bg-ink px-1 text-[0.6rem] leading-4 font-bold text-paper">F</kbd>}
          {inline && <span>{t.button}</span>}
        </button>
      )}
      {open && (
        <Dialog open onOpenChange={(next) => { if (!next) close(false) }}>
          <DialogContent
            aria-describedby={undefined}
            overlayClassName="bg-ink/25 backdrop-blur-[1px]"
            className={cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden, 'flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-md flex-col items-center gap-4 overflow-y-auto p-6')}
          >
            <DialogTitle className="font-display text-2xl tracking-tight uppercase">{t.title}</DialogTitle>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing to optimize
              <img src={photo.url} alt={t.alt} width={SOUVENIR_SIZE.width} height={SOUVENIR_SIZE.height}
                className="h-auto max-h-[52dvh] w-auto rounded-md shadow-md" />
            ) : failed ? (
              <p role="alert" className="text-sm text-red-700">{t.error}</p>
            ) : (
              <p role="status" className="py-10 text-sm text-muted-foreground">{t.making}</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {photo?.canShare && (
                <button type="button" onClick={() => void share()}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-collage-yellow px-5 py-2.5 text-sm font-semibold text-ink">
                  <Share2 className="h-4 w-4" aria-hidden="true" /> {t.share}
                </button>
              )}
              {photo && (
                <a href={photo.url} download={FILE_NAME} onClick={() => track('souvenir_download')}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold">
                  <Download className="h-4 w-4" aria-hidden="true" /> {t.download}
                </a>
              )}
              <button type="button" onClick={() => close(true)}
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold">
                {t.close}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
