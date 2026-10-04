'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Artwork } from '@/data/artworks'
import { TrackedLink } from '@/components/track'
import { track } from '@/lib/track'
import { readReferralCookie, readReferralParam } from '@/lib/referral'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import styles from '../gallery-theme.module.css'
import { PresenceNote } from './PresenceCounter'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

type StartScreenProps = {
  /** Today's walls, to name the artist whose shared link brought this visitor. */
  artworks: Artwork[]
  label: string
  hint: string
  /** Show how many people are inside — only meaningful before the first entry. */
  showPresence: boolean
  onEnter: () => void
}

// The artist whose shared link (lib/referral.ts) brought this visitor, when
// their obra hangs today — one that doesn't sends the visitor to its own
// page (Game.tsx), which greets them there. Anyone signed in is left out:
// artists already take part, and the rest get asked to finish signing up on
// the home (ParticipationStatus). Reading the session is local, no request.
function useInviter(artworks: Artwork[]): string | null {
  const [inviter, setInviter] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const slug = readReferralParam(window.location.search) ?? readReferralCookie(document.cookie)
    const artist = slug ? artworks.find((artwork) => artwork.id === slug)?.artist : undefined
    if (!artist) return
    void (async () => {
      try {
        if (isSupabaseConfigured) {
          const { data } = await createClient().auth.getSession()
          if (data.session) return
        }
        if (!cancelled) setInviter(artist)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [artworks])
  return inviter
}

export function StartScreen({ artworks, label, hint, showPresence, onEnter }: StartScreenProps) {
  const { m } = useI18n()
  const inviter = useInviter(artworks)
  return (
    <div className={`${styles.startScreen} animate-in fade-in absolute inset-0 z-30 flex items-center justify-center p-4 duration-300`}>
      <section className={styles.startPanel} aria-labelledby="gallery-start-title">
        <div className={styles.windowsTitlebar} aria-hidden="true">
          <span>museo.exe</span><span>□ ×</span>
        </div>
        <p className="mb-2 text-xs font-bold tracking-[0.18em] opacity-60">{m.gallery.startEyebrow}</p>
        <h1 id="gallery-start-title" className={styles.title}>{m.gallery.startTitle}</h1>
      <button
        type="button"
        id="gallery-enter-button"
        onClick={onEnter}
        className={styles.enterButton}
      >
        {label}
      </button>
      {showPresence && <PresenceNote />}
      <p className={styles.hint}>{hint}</p>
      {inviter && (
        <p className="mt-4 text-sm">
          {fmt(m.share.invite.from, { name: inviter })} {m.share.invite.body}{' '}
          <TrackedLink href="/onboarding" event="referral_invite_click" className="font-semibold whitespace-nowrap underline">
            {m.share.invite.cta} →
          </TrackedLink>
        </p>
      )}
      {/* The way back to the rest of the Mundial — signed-in visitors who
          haven't finished signing up get asked to there (ParticipationStatus). */}
      <Link href="/" onClick={() => track('home_from_gallery')} className="mt-4 inline-block text-sm font-semibold underline opacity-80 hover:opacity-100">
        {m.gallery.homeLink}
      </Link>
      <TrackedLink href="/partners" event="partners_click_gallery" className="mt-2 block text-xs underline opacity-60 hover:opacity-100">
        {m.gallery.partnersLink}
      </TrackedLink>
      </section>
    </div>
  )
}
