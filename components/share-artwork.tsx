'use client'

import { useState } from 'react'
import { PublishArtworkOffer } from '@/components/community/publish-artwork-offer'
import { ShareLinks } from '@/components/share-links'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { withReferral } from '@/lib/referral'

const EVENTS = {
  share: 'obra_share_click',
  handoff: 'obra_share_handoff',
  copied: 'obra_link_copied',
  whatsapp: 'obra_whatsapp_click',
  story: 'obra_story_download',
} as const

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
  const { m } = useI18n()
  const t = m.share
  const [storyOpened, setStoryOpened] = useState(false)
  return (
    <ShareLinks
      heading={isOwn ? t.heading : t.headingOther}
      title={title}
      text={fmt(isOwn ? t.textOwn : t.text, { title, name })}
      path={withReferral(isPublic ? `/obras/${slug}` : '/', slug)}
      storyHref={`/obras/${slug}/historia`}
      events={EVENTS}
      onStory={isOwn ? () => setStoryOpened(true) : undefined}
      footer={isOwn ? <PublishArtworkOffer slug={slug} isPublic={isPublic} opened={storyOpened} /> : undefined}
    />
  )
}
