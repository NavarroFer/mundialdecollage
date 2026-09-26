import { SiteHeader } from '@/components/site-header'
import { SplashScreen } from '@/components/splash-screen'
import { GalleryTour } from '@/components/gallery-tour'
import { HeroSection } from '@/components/hero-section'
import { FlagRibbon } from '@/components/flag-ribbon'
import { ParticipationStatus } from '@/components/participation-status'
import { BasesBanner } from '@/components/bases-banner'
import { AboutSection } from '@/components/about-section'
import { EditionSection } from '@/components/edition-section'
import { WorkshopSection } from '@/components/workshop-section'
import { ParticipantsSection } from '@/components/participants-section'
import { MapSection } from '@/components/map-section'
import { JurySection } from '@/components/jury-section'
import { Footer } from '@/components/footer'

// Renders per request so a new submission shows up without a redeploy.
export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <>
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
          <BasesBanner />
          <EditionSection />
          <AboutSection />
          <ParticipantsSection />
          <MapSection />
          <JurySection />
          <WorkshopSection />
        </main>
        <Footer />
      </div>
    </>
  )
}
