'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { galleryArtworkPath } from '@/lib/gallery-return'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

// Every share brings someone new into the gallery, straight to this obra
// (Game.tsx opens it, or its /obras page once it's no longer on the walls).
// The phone's share sheet when there is one, else the link is copied.
export function ArtworkShare({ slug, title, artist }: { slug: string; title: string; artist: string }) {
  const [copied, setCopied] = useState(false)
  const { m } = useI18n()
  const t = m.gallery.share

  async function share() {
    track('share_click')
    const url = `${window.location.origin}${galleryArtworkPath(slug)}`
    const text = fmt(t.text, { title, artist })
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

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t.button}
      </button>
      {copied && <span role="status" className="text-sm text-muted-foreground">{t.copied}</span>}
    </div>
  )
}
