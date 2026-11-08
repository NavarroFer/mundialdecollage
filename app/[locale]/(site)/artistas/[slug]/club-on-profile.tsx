'use client'

import { ArrowRight, Building2 } from 'lucide-react'
import { PromoCard } from '@/components/store-promo'
import { TrackedLink } from '@/components/track'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { useArtistSocial } from './use-artist-social'

// The profile and the Club, joined: a member's profile leads into their 3D
// gallery; the artist without one is invited to make it, and any visitor
// learns the Club exists. Whether there's a gallery comes with the likes
// (app/api/artistas/[slug]/social), so the page itself stays static.
export type ClubTexts = { eyebrow: string; title: string; body: string; cta: string; enter: string }

export function ClubOnProfile({ slug, name, isOwn, clubOpen, show, texts }: {
  slug: string
  name: string
  isOwn: boolean
  clubOpen: boolean
  /** 'gallery' near the top for a member, 'invite' at the end for everyone else. */
  show: 'gallery' | 'invite'
  /** From m.clubLanding, which the browser bundle doesn't carry whole. */
  texts: ClubTexts
}) {
  const { m } = useI18n()
  const t = m.artistProfile
  const social = useArtistSocial(slug)
  if (social === undefined) return null

  const club = social?.club
  if (show === 'gallery') {
    if (!club) return null
    return (
      <PromoCard
        href={`/club/${club.slug}`}
        event="profile_club_enter_click"
        icon={Building2}
        eyebrow={texts.eyebrow}
        title={`«${club.title}»`}
        body={isOwn ? t.clubOwnBody : fmt(t.clubBody, { name })}
        cta={isOwn ? t.clubOwnCta : texts.enter}
      />
    )
  }

  if (club || !clubOpen) return null
  if (isOwn) {
    return (
      <PromoCard
        href="/club"
        event="profile_club_join_click"
        icon={Building2}
        eyebrow={texts.eyebrow}
        title={texts.title}
        body={texts.body}
        cta={texts.cta}
      />
    )
  }
  return (
    <p className="text-center text-sm text-muted-foreground">
      {t.clubInvite}{' '}
      <TrackedLink href="/club" prefetch={false} event="profile_club_join_click" className="inline-flex items-center gap-1 font-semibold text-collage-blue underline-offset-4 hover:underline">
        {texts.cta}
        <ArrowRight className="size-4" aria-hidden="true" />
      </TrackedLink>
    </p>
  )
}
