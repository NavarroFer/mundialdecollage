import { SiteHeader } from '@/components/site-header'
import { SplashScreen } from '@/components/splash-screen'
import { GalleryTour } from '@/components/gallery-tour'
import { HeroSection } from '@/components/hero-section'
import { FlagRibbon } from '@/components/flag-ribbon'
import { StampAlbum } from '@/components/stamp-album'
import { ParticipationStatus } from '@/components/participation-status'
import { ReferralInvite } from '@/components/referral-invite'
import { BasesBanner } from '@/components/bases-banner'
import { CommunityStrip } from '@/components/community/community-strip'
import { AboutSection } from '@/components/about-section'
import { DonationSection } from '@/components/donation-section'
import { HomeStoreSection } from '@/components/home-store-section'
import { ClubSection } from '@/components/club-section'
import { EditionSection } from '@/components/edition-section'
import { ParticipantsSection } from '@/components/participants-section'
import { MapSection } from '@/components/map-section'
import { JurySection } from '@/components/jury-section'
import { Footer } from '@/components/footer'
import { TrackView } from '@/components/track'
import { ArtistFeedHome } from '@/components/artist-feed-home'
import { SiteSections } from '@/components/site-sections'
import { viewerCanSeeObraFeed } from '@/lib/feed-access'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Renders per request so a new submission shows up without a redeploy.
// The anonymous copy (anon/page.tsx) calls renderAsAnonymous() first, so
// getCurrentUser() is null and this stays the public home on the CDN.
export const dynamic = 'force-dynamic'

async function homeKind(forceSite: boolean): Promise<'feed' | 'artist-site' | 'public'> {
  if (!isSupabaseConfigured) return 'public'
  // Server-side: no obra submitted means the public home, not the feed.
  const sees = await viewerCanSeeObraFeed()
  if (!sees) return 'public'
  return forceSite ? 'artist-site' : 'feed'
}

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string | string[]; sitio?: string }> }) {
  const { ref, sitio } = await searchParams
  const kind = await homeKind(sitio === '1')
  if (kind === 'feed') return <ArtistFeedHome />
  return (
    <>
      <TrackView event="home_view" />
      <SplashScreen />
      <GalleryTour />
      {/* Wrapped so SplashScreen can mark it inert while it covers the
          screen — otherwise keyboard/AT users could Tab into content
          that's hidden behind the splash but still in the DOM. */}
      <div id="site-content">
        <SiteHeader />
        {kind === 'artist-site' && <SiteSections here="site" />}
        <main>
          <HeroSection />
          <FlagRibbon />
          <ParticipationStatus />
          {/* An artist's guest (lib/referral.ts), in the slot ParticipationStatus
              uses for the signed in — who get asked to finish there instead. */}
          <ReferralInvite
            refParam={ref}
            hideForSignedIn
            className="mx-auto max-w-4xl px-5 pt-10 sm:px-8 sm:pt-14"
          />
          <CommunityStrip />
          <BasesBanner />
          <EditionSection />
          {/* Before the obras: after them it sat 8–9 phone screens down,
              past where most visitors stop scrolling. */}
          <HomeStoreSection />
          <ClubSection />
          <ParticipantsSection />
          <MapSection />
          <JurySection />
          <AboutSection />
          <DonationSection />
        </main>
        <Footer />
        <StampAlbum />
      </div>
    </>
  )
}
