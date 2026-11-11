import { CommunityFeed } from '@/components/community/community-feed'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { SiteSections } from '@/components/site-sections'
import { TrackView } from '@/components/track'
import { getCallState } from '@/lib/call-state'
import { getI18n } from '@/lib/i18n/server'

// The home a logged-in artist sees: the feed, and the rest of the site in
// sections above it. The feed itself is still fetched in the browser.
export async function ArtistFeedHome() {
  const [{ m }, { open }] = await Promise.all([getI18n(), getCallState()])
  return (
    <>
      <TrackView event="home_view" />
      <div id="site-content">
        <SiteHeader />
        <SiteSections here="feed" />
        <main className="bg-grain py-8 sm:py-12">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <h1 className="font-display text-4xl tracking-tight text-ink uppercase sm:text-5xl">{m.community.title}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{m.community.metaDescription}</p>
            <div className="mt-8">
              <CommunityFeed callOpen={open} />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
