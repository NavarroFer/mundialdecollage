import { AppFrame } from '@/components/app-frame'
import { OfferBanners } from '@/components/offer-banners'
import { ObraActivityFeed } from '@/components/obra-activity-feed'
import { TrackView } from '@/components/track'
import { fmt } from '@/lib/i18n/format'
import { getCallState } from '@/lib/call-state'
import { getI18n } from '@/lib/i18n/server'
import { getCurrentUser } from '@/lib/supabase/server'

// Participating artists only. The page that renders this already checked
// the session; the feed request checks again.
export async function ArtistFeedHome() {
  const [{ m }, user, { open }] = await Promise.all([getI18n(), getCurrentUser(), getCallState()])
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0]

  return (
    <AppFrame narrow search>
      <TrackView event="home_view" />
      <OfferBanners place="feed" className="mb-4" />
      {/* Kept short, like the banners above it: the first obra should
          already show in the lower half of a phone screen. There the tabs
          under it say what the feed is, so the line explaining it waits for
          a wider screen. */}
      <header className="border-b-2 border-ink/10 pb-3 sm:pb-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {firstName ? fmt(m.header.helloName, { name: firstName }) : m.header.hello}
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{m.community.title}</h1>
        <p className="mt-1.5 hidden max-w-xl text-muted-foreground sm:block">{m.community.feedSubtitle}</p>
      </header>
      <div className="mt-4">
        <ObraActivityFeed callOpen={open} />
      </div>
    </AppFrame>
  )
}
