'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Artwork } from '@/data/artworks'
import { TrackedLink } from '@/components/track'
import { DonationForm } from '@/components/donation-form'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/track'
import { readReferralCookie, readReferralParam } from '@/lib/referral'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { AvatarPicker } from './AvatarPicker'
import { VisitPreferences } from './VisitPreferences'
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
  onResume: (id: string) => void
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

export function StartScreen({ artworks, label, hint, showPresence, onEnter, onResume }: StartScreenProps) {
  const { m } = useI18n()
  const inviter = useInviter(artworks)
  // The home's look whatever the walls' theme: the themes dress the walk,
  // the menu around it is the Mundial's.
  return (
    <div className="animate-in fade-in absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-4 pt-20 font-sans text-ink duration-300">
      <section
        className="bg-grain my-auto w-full max-w-2xl rounded-3xl border-2 border-ink/10 bg-paper p-6 shadow-[6px_8px_0_rgba(27,17,12,0.16)] sm:p-10"
        aria-labelledby="gallery-start-title"
      >
        <span className="torn-strip inline-block -rotate-2 bg-collage-blue px-4 py-2 text-[0.7rem] font-bold tracking-[0.12em] text-primary-foreground uppercase sm:px-5 sm:text-xs sm:tracking-[0.2em]">
          {m.gallery.startEyebrow}
        </span>
        <h1 id="gallery-start-title" className="font-display mt-6 text-4xl tracking-tight uppercase sm:text-6xl">
          {m.gallery.startTitle}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{m.gallery.tutorial.welcome}</p>
        <AvatarPicker />
        <Button type="button" variant="primary" size="lg" onClick={onEnter} className="mt-6 h-16 w-full px-10 text-lg sm:w-auto">
          {label}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
        {showPresence && <PresenceNote />}
        <details className="mt-4">
          <summary className="cursor-pointer py-2 text-sm font-semibold">{m.gallery.mobileMenu.open}</summary>
          <VisitPreferences artworks={artworks} onResume={onResume} />
        </details>
        {inviter && (
          <p className="mt-4 text-sm">
            {fmt(m.share.invite.from, { name: inviter })} {m.share.invite.body}{' '}
            <TrackedLink href="/onboarding" event="referral_invite_click" className="font-semibold whitespace-nowrap underline">
              {m.share.invite.cta} →
            </TrackedLink>
          </p>
        )}
        {/* Before the first entry and on every pause (lib/donations.ts). */}
        <section aria-labelledby="gallery-donate-title" className="mt-6 border-t-2 border-dashed border-ink/15 pt-6">
          <p id="gallery-donate-title" className="mb-4 text-sm font-bold">{m.donate.galleryBody}</p>
          <DonationForm origin="gallery" />
        </section>
        {/* The way back to the rest of the Mundial — signed-in visitors who
            haven't finished signing up get asked to there (ParticipationStatus). */}
        <Link href="/" onClick={() => track('home_from_gallery')} className="mt-6 inline-block text-sm font-semibold underline underline-offset-4 hover:text-collage-red">
          {m.gallery.homeLink}
        </Link>
        <TrackedLink href="/partners" event="partners_click_gallery" className="mt-2 block text-xs text-muted-foreground underline underline-offset-4 hover:text-ink">
          {m.gallery.partnersLink}
        </TrackedLink>
      </section>
    </div>
  )
}
