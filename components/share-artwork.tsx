'use client'

import { useState } from 'react'
import { Download, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { withReferral } from '@/lib/referral'

const pill =
  'inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30'

// Every artist who shares is the Mundial's best invitation. A published obra
// is shared by its own link, whose preview is the obra (opengraph-image.tsx);
// one still under review would 404 for everyone else, so its artist shares
// the home instead — and can post the story image either way. Both links
// carry ?ref=<slug> (lib/referral.ts): whoever opens one is greeted as the
// artist's guest and invited to send their own obra.
export function ShareArtwork({
  slug,
  title,
  name,
  isPublic,
  isOwn,
}: {
  slug: string
  title: string
  name: string
  isPublic: boolean
  isOwn: boolean
}) {
  const [copied, setCopied] = useState(false)
  const { m } = useI18n()
  const t = m.share

  const text = fmt(isOwn ? t.textOwn : t.text, { title, name })
  const link = () => `${window.location.origin}${withReferral(isPublic ? `/obras/${slug}` : '/', slug)}`

  async function share() {
    track('obra_share_click')
    const url = link()
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Closing the share sheet rejects too — nothing to report.
    }
  }

  function whatsapp() {
    track('obra_whatsapp_click')
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link()}`)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-background p-5 text-left">
      <p className="font-display text-xl tracking-tight text-ink uppercase">{isOwn ? t.heading : t.headingOther}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" className="gap-2" onClick={() => void share()}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t.button}
        </Button>
        <button type="button" className={pill} onClick={whatsapp}>
          <MessageCircle className="h-4 w-4 text-collage-blue" aria-hidden="true" />
          WhatsApp
        </button>
        <a href={`/obras/${slug}/historia`} download rel="nofollow" className={pill} onClick={() => track('obra_story_download')}>
          <Download className="h-4 w-4 text-collage-red" aria-hidden="true" />
          {t.story}
        </a>
        {copied && <span role="status" className="text-sm text-muted-foreground">{t.copied}</span>}
      </div>
      {isOwn && !isPublic && <p className="mt-3 text-sm text-muted-foreground">{t.pending}</p>}
    </div>
  )
}
