import Link from 'next/link'
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
    <AppFrame narrow>
      <TrackView event="home_view" />
      <header className="border-b-2 border-ink/10 pb-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {firstName ? fmt(m.header.helloName, { name: firstName }) : m.header.hello}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-4xl tracking-tight text-ink uppercase">{m.community.title}</h1>
          <Link
            href="/comunidad"
            className="rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
          >
            {m.community.feedSeeCommunity}
          </Link>
        </div>
        <p className="mt-2 max-w-xl text-muted-foreground">{m.community.feedSubtitle}</p>
      </header>
      <div className="mt-5">
        <ObraActivityFeed />
      </div>
    </AppFrame>
  )
}
