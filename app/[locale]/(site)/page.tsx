import { SiteHeader } from '@/components/site-header'
import { SplashScreen } from '@/components/splash-screen'
import { GalleryTour } from '@/components/gallery-tour'
import { HeroSection } from '@/components/hero-section'
import { FlagRibbon } from '@/components/flag-ribbon'
import { StampAlbum } from '@/components/stamp-album'
import { ParticipationStatus } from '@/components/participation-status'
import { ReferralInvite } from '@/components/referral-invite'
import { BasesBanner } from '@/components/bases-banner'
import { AboutSection } from '@/components/about-section'
import { EditionSection } from '@/components/edition-section'
import { ParticipantsSection } from '@/components/participants-section'
import { MapSection } from '@/components/map-section'
import { JurySection } from '@/components/jury-section'
import { Footer } from '@/components/footer'
import { TrackView } from '@/components/track'

// Renders per request so a new submission shows up without a redeploy.
export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const { ref } = await searchParams
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
          <BasesBanner />
          <EditionSection />
          <ParticipantsSection />
          <MapSection />
          <JurySection />
          <AboutSection />
        </main>
        <Footer />
        <StampAlbum />
      </div>
    </>
  )
}
