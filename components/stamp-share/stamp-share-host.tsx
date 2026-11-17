'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { STAMP_LOOKS, STAMP_TONES } from '@/components/stamp-catalog'
import { canvasFonts } from '@/components/gallery/fonts'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'
import { STAMP_KEYS, STAMP_SHARE_EVENT, type StampKey, type StampShareRequest } from '@/lib/stamps'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { composeStampImage, loadBanner, STAMP_IMAGE_SIZES, svgImage, type StampImageFormat } from './compose'

const DOMAIN = 'mundialdecollage.com.ar'
const FORMATS: StampImageFormat[] = ['story', 'feed']

// `key` says which stamp and format it was drawn for, so one still on screen
// from the previous choice is never shown for the new one.
type Picture = { key: string; blob: Blob; url: string; canShare: boolean }

const fileName = (stamp: StampKey, format: StampImageFormat) => `mundial-de-collage-logro-${stamp}-${format}.jpg`

/**
 * The share dialog for a stamp earned: its image for an Instagram story
 * (1080x1920) or a feed post (1080x1440), to share from the phone's sheet or
 * to save. One host in the root layout; anything opens it with
 * openStampShare() (lib/stamps.ts), like showNotice().
 */
export function StampShareHost() {
  const { locale, m } = useI18n()
  const [request, setRequest] = useState<StampShareRequest | null>(null)
  const [format, setFormat] = useState<StampImageFormat>('story')
  const [drawn, setPicture] = useState<Picture | null>(null)
  const [failedKey, setFailed] = useState<string | null>(null)
  const iconHolder = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onShare = (event: Event) => {
      setRequest((event as CustomEvent<StampShareRequest>).detail)
      track('stamp_share_open')
      setFormat('story')
    }
    window.addEventListener(STAMP_SHARE_EVENT, onShare)
    return () => window.removeEventListener(STAMP_SHARE_EVENT, onShare)
  }, [])

  const stamp = request?.stamp ?? null
  const count = request?.count ?? 0
  const key = `${stamp}:${format}:${count}:${locale}`
  useEffect(() => {
    if (!stamp) return
    let gone = false
    let url: string | null = null
    ;(async () => {
      try {
        const look = STAMP_LOOKS[stamp]
        const tone = STAMP_TONES[look.tone]
        const fonts = canvasFonts(locale === 'ru')
        const copy = m.stamps[stamp]
        await Promise.all([
          document.fonts.load(`96px ${fonts.display}`, copy.title.toUpperCase()),
          document.fonts.load(`700 40px ${fonts.body}`, copy.body),
        ])
        // The icon is whatever the page draws for it: render it, then copy it.
        const svg = iconHolder.current?.querySelector('svg')
        if (!svg) throw new Error('icon')
        const [icon, cutout, banner] = await Promise.all([svgImage(svg, tone.ink, 320, 2.4), svgImage(svg, '#FBF8F0', 320, 4.6), loadBanner()])
        const canvas = composeStampImage({
          format,
          text: {
            badge: m.stamps.image.badge,
            title: copy.title,
            body: copy.body,
            album: m.stamps.eyebrow,
            progress: fmt(m.stamps.image.progress, { count, total: STAMP_KEYS.length }),
            cta: m.stamps.image.cta,
            domain: DOMAIN,
            date: formatDayMonth(locale, new Date().toISOString()),
          },
          number: STAMP_KEYS.indexOf(stamp) + 1,
          total: STAMP_KEYS.length,
          count,
          tone,
          icon,
          cutout,
          banner,
          fonts,
        })
        const blob = canvas && await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
        if (!blob) throw new Error('encode')
        if (gone) return
        url = URL.createObjectURL(blob)
        const file = new File([blob], fileName(stamp, format), { type: 'image/jpeg' })
        setPicture({ key, blob, url, canShare: navigator.canShare?.({ files: [file] }) ?? false })
      } catch {
        if (!gone) setFailed(key)
      }
    })()
    return () => {
      gone = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [stamp, count, format, locale, m, key])

  const close = useCallback(() => setRequest(null), [])

  if (!request || !stamp) return null
  const picture = drawn?.key === key ? drawn : null
  const failed = failedKey === key
  const t = m.stamps.image
  const copy = m.stamps[stamp]
  const { Icon } = STAMP_LOOKS[stamp]
  const size = STAMP_IMAGE_SIZES[format]

  async function share() {
    if (!picture || !stamp) return
    track('stamp_share')
    try {
      await navigator.share({
        files: [new File([picture.blob], fileName(stamp, format), { type: 'image/jpeg' })],
        text: `${fmt(t.shareText, { title: copy.title })} ${window.location.origin}`,
      })
    } catch (error) {
      // Closing the share sheet rejects with AbortError: nothing to do.
      // Anything else (an app's browser that won't share files) saves it.
      if (!(error instanceof DOMException && error.name === 'AbortError')) save()
    }
  }

  function save() {
    if (!picture || !stamp) return
    track('stamp_download')
    const link = document.createElement('a')
    link.href = picture.url
    link.download = fileName(stamp, format)
    link.click()
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-ink/60 backdrop-blur-[2px]"
        className="z-[2147483645] flex max-h-[94dvh] w-[calc(100%-2rem)] max-w-md flex-col items-center gap-4 overflow-y-auto p-6"
      >
        <DialogTitle className="font-display text-2xl tracking-tight uppercase">{t.title}</DialogTitle>
        {/* Rendered only so the canvas can copy it. */}
        <span ref={iconHolder} className="sr-only" aria-hidden="true"><Icon /></span>

        <div role="radiogroup" aria-label={t.title} className="grid w-full grid-cols-2 gap-1 rounded-full border-2 border-ink/15 p-1">
          {FORMATS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={format === option}
              onClick={() => setFormat(option)}
              className={cn(
                'min-h-10 rounded-full px-4 text-sm font-bold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                format === option ? 'bg-ink text-paper' : 'hover:bg-ink/10',
              )}
            >
              {option === 'story' ? t.story : t.feed} <span className="font-normal opacity-70">{STAMP_IMAGE_SIZES[option].width}×{STAMP_IMAGE_SIZES[option].height}</span>
            </button>
          ))}
        </div>

        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing to optimize
          <img src={picture.url} alt={fmt(t.alt, { title: copy.title })} width={size.width} height={size.height} className="h-auto max-h-[50dvh] w-auto max-w-full rounded-md shadow-md" />
        ) : failed ? (
          <p role="alert" className="py-10 text-sm text-red-700">{t.error}</p>
        ) : (
          <p role="status" className="py-10 text-sm text-muted-foreground">{t.making}</p>
        )}

        <div className="flex w-full flex-col items-center gap-2">
          {picture?.canShare && (
            <button type="button" onClick={() => void share()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/20 bg-collage-yellow px-5 py-3 text-base font-semibold text-ink">
              <Share2 className="h-5 w-5" aria-hidden="true" /> {t.share}
            </button>
          )}
          {picture && (
            <button
              type="button"
              onClick={save}
              className={picture.canShare
                ? 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-sm font-semibold'
                : 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/20 bg-collage-yellow px-5 py-3 text-base font-semibold text-ink'}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> {t.download}
            </button>
          )}
          <button type="button" onClick={close} className="inline-flex min-h-11 items-center px-5 py-2 text-sm font-semibold underline">{t.close}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
