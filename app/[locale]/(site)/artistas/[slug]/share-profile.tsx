'use client'

import { ShareLinks } from '@/components/share-links'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { withReferral } from '@/lib/referral'

const EVENTS = {
  share: 'profile_share_click',
  handoff: 'profile_share_handoff',
  copied: 'profile_link_copied',
  whatsapp: 'profile_whatsapp_click',
  story: 'profile_story_download',
} as const

// The profile's own link, with ?ref= its latest obra so whoever arrives is
// greeted as the artist's guest (lib/referral.ts). The story image is that
// obra's, already drawn once and kept in R2 (/obras/[slug]/historia).
export function ShareProfile({ slug, name, artworkSlug, isOwn }: { slug: string; name: string; artworkSlug: string; isOwn: boolean }) {
  const { m } = useI18n()
  const t = m.share
  return (
    <ShareLinks
      heading={isOwn ? t.profileHeading : t.profileHeadingOther}
      title={name}
      text={fmt(isOwn ? t.profileTextOwn : t.profileText, { name })}
      path={withReferral(`/artistas/${slug}`, artworkSlug)}
      storyHref={`/obras/${artworkSlug}/historia`}
      events={EVENTS}
    />
  )
}
