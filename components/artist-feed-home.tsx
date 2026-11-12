import { AppFrame } from '@/components/app-frame'
import { ObraActivityFeed } from '@/components/obra-activity-feed'
import { TrackView } from '@/components/track'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { getCurrentUser } from '@/lib/supabase/server'

// Participating artists only. The page that renders this already checked
// the session; the feed request checks again.
export async function ArtistFeedHome() {
  const [{ m }, user] = await Promise.all([getI18n(), getCurrentUser()])
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0]

  return (
    <AppFrame narrow search>
      <TrackView event="home_view" />
      <header className="border-b-2 border-ink/10 pb-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {firstName ? fmt(m.header.helloName, { name: firstName }) : m.header.hello}
        </p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink uppercase">{m.community.title}</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{m.community.feedSubtitle}</p>
      </header>
      <div className="mt-5">
        <ObraActivityFeed />
      </div>
    </AppFrame>
  )
}
