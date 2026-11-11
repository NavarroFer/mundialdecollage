import { AppFrame } from '@/components/app-frame'
import { ObraActivityFeed } from '@/components/obra-activity-feed'
import { TrackView } from '@/components/track'
import { getI18n } from '@/lib/i18n/server'

// Participating artists only. The page that renders this already checked
// the session; the feed request checks again.
export async function ArtistFeedHome() {
  const { m } = await getI18n()
  return (
    <AppFrame narrow>
      <TrackView event="home_view" />
      <h1 className="font-display text-4xl tracking-tight text-ink uppercase">{m.collage.label}</h1>
      <p className="mt-2 text-muted-foreground">{m.participants.playSub}</p>
      <div className="mt-6">
        <ObraActivityFeed />
      </div>
    </AppFrame>
  )
}
