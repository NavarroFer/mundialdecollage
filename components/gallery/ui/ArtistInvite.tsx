'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'

// Friends of an artist sign in with Google to like or comment their obra,
// and then leave. Right after they do, while the account is fresh, ask
// whether they make collage too. Only shown to viewers who aren't artists
// yet (canJoin in getArtworkSocial).
export function ArtistInvite({ onDismiss }: { onDismiss: () => void }) {
  const { m } = useI18n()
  const t = m.artistInvite
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    track('artist_invite_view')
    // After a comment it lands below the fold of the modal.
    ref.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <section ref={ref} aria-labelledby={titleId}
      className="animate-in fade-in space-y-2 rounded-xl border border-l-4 border-ink/15 border-l-[color:var(--gallery-accent)] p-4 duration-300 motion-reduce:animate-none">
      <h3 id={titleId} className="text-base font-bold text-ink">{t.title}</h3>
      <p className="text-sm">{t.body}</p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link href="/onboarding" onClick={() => track('artist_invite_click')}
          className="inline-flex items-center rounded-[var(--gallery-radius)] bg-ink px-4 py-2 text-sm font-semibold text-paper">
          {t.cta}
        </Link>
        <button type="button" onClick={onDismiss} className="text-sm font-semibold text-muted-foreground underline">
          {t.dismiss}
        </button>
      </div>
    </section>
  )
}
