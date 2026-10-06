'use client'

import { useState } from 'react'
import { Copy, MessageCircle, Share2 } from 'lucide-react'
import { galleryArtworkPath } from '@/lib/gallery-return'
import { withReferral } from '@/lib/referral'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

// Every share brings someone new into the gallery, straight to this obra
// (Game.tsx opens it, or its /obras page once it's no longer on the walls).
// The phone's share sheet when there is one, else the link is copied. The
// link names the obra as the referrer (lib/referral.ts), so whoever opens it
// is invited in on its artist's behalf.
export function ArtworkShare({ slug, title, artist }: { slug: string; title: string; artist: string }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const { m } = useI18n()
  const t = m.gallery.share
  const link = () => `${window.location.origin}${withReferral(galleryArtworkPath(slug), slug)}`

  async function copyLink() {
    setCopyError(false)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(link())
      track('gallery_link_copied')
      setCopied(true)
    } catch {
      setCopyError(true)
    }
  }

  function whatsapp() {
    track('gallery_whatsapp_click')
    const text = fmt(t.text, { title, artist })
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link()}`)}`, '_blank', 'noopener,noreferrer')
  }

  async function share() {
    track('share_click')
    const url = link()
    const text = fmt(t.text, { title, artist })
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        track('gallery_share_handoff')
        return
      }
      await copyLink()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      await copyLink()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t.button}
      </button>
      <button type="button" onClick={whatsapp} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
      </button>
      <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">
        <Copy className="h-4 w-4" aria-hidden="true" /> {m.share.copyLink}
      </button>
      {copied && <span role="status" className="text-sm text-muted-foreground">{t.copied}</span>}
      {copyError && <span role="alert" className="text-sm text-collage-red">{m.share.copyFailed}</span>}
    </div>
  )
}
