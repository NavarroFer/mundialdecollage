'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { track } from '@/lib/track'
import { useI18n } from '@/lib/i18n/client'
import { WaitlistOneClick } from '@/components/waitlist-signup'

// Friends of an artist sign in with Google to like or comment their obra,
// and then leave. Right after they do, while the account is fresh, ask
// whether they make collage too. Only shown to viewers who aren't artists
// yet (canJoin in getArtworkSocial). Sending an obra is the one primary
// action; the «Avisame» for those who don't make collage comes second.
export function ArtistInvite({ onDismiss, onAccept }: { onDismiss: () => void; onAccept: () => void }) {
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
      className="animate-in fade-in space-y-3 rounded-xl border border-l-4 border-ink/15 border-l-[color:var(--gallery-accent)] p-4 duration-300 motion-reduce:animate-none">
      <h3 id={titleId} className="text-base font-bold text-ink">{t.title}</h3>
      <p className="text-sm">{t.body}</p>
      <Link href="/onboarding" onClick={() => { track('artist_invite_click'); onAccept() }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--gallery-radius)] bg-ink px-5 py-3 text-base font-semibold text-paper">
        {t.cta}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      {/* Most of them are the artist's friends, not artists: keep them
          around for the finalists and the magazine instead. */}
      <WaitlistOneClick />
      <button type="button" onClick={onDismiss} className="min-h-11 text-sm font-semibold text-muted-foreground underline">
        {t.dismiss}
      </button>
    </section>
  )
}
