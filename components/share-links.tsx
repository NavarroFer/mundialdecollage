'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Download, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/track'
import type { FunnelEvent } from '@/lib/funnel'
import { useI18n } from '@/lib/i18n/client'

const pill =
  'inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30'

export type ShareEvents = {
  share: FunnelEvent
  handoff: FunnelEvent
  copied: FunnelEvent
  whatsapp: FunnelEvent
  story: FunnelEvent
}

/**
 * The share row an obra and an artist profile both offer: the phone's share
 * menu (or a copy where there's none), WhatsApp, copy link and the story
 * image. `path` is resolved against the current origin when clicked.
 */
export function ShareLinks({
  heading,
  title,
  text,
  path,
  storyHref,
  events,
  footer,
  onStory,
}: {
  heading: string
  title: string
  text: string
  path: string
  storyHref: string
  events: ShareEvents
  footer?: ReactNode
  /** Fired with the story download, so Comunidad can offer to post the obra. */
  onStory?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const { m } = useI18n()
  const t = m.share
  const link = () => `${window.location.origin}${path}`

  async function copyLink() {
    setCopyError(false)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(link())
      track(events.copied)
      setCopied(true)
    } catch {
      setCopyError(true)
    }
  }

  async function share() {
    track(events.share)
    const url = link()
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        track(events.handoff)
        return
      }
      await copyLink()
    } catch (error) {
      // A cancelled share is intentional; other failures can still copy.
      if (error instanceof Error && error.name === 'AbortError') return
      await copyLink()
    }
  }

  function whatsapp() {
    track(events.whatsapp)
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link()}`)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-background p-5 text-left">
      <p className="font-display text-xl tracking-tight text-ink uppercase">{heading}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" className="gap-2" onClick={() => void share()}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t.button}
        </Button>
        <button type="button" className={pill} onClick={whatsapp}>
          <MessageCircle className="h-4 w-4 text-collage-blue" aria-hidden="true" />
          WhatsApp
        </button>
        <button type="button" className={pill} onClick={() => void copyLink()}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {t.copyLink}
        </button>
        <a href={storyHref} download rel="nofollow" className={pill} onClick={() => { track(events.story); onStory?.() }}>
          <Download className="h-4 w-4 text-collage-red" aria-hidden="true" />
          {t.story}
        </a>
        {copied && <span role="status" className="text-sm text-muted-foreground">{t.copied}</span>}
      </div>
      {copyError && <p role="alert" className="mt-3 text-sm text-collage-red">{t.copyFailed}</p>}
      {footer}
    </div>
  )
}
