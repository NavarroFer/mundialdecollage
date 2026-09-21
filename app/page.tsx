import { SiteHeader } from '@/components/site-header'
import { SplashScreen } from '@/components/splash-screen'
import { HeroSection } from '@/components/hero-section'
import { ParticipationStatus } from '@/components/participation-status'
import { BasesBanner } from '@/components/bases-banner'
import { EditionSection } from '@/components/edition-section'
import { HowToSection } from '@/components/how-to-section'
import { AboutSection } from '@/components/about-section'
import { WorkshopSection } from '@/components/workshop-section'
import { ParticipantsSection } from '@/components/participants-section'
import { MapSection } from '@/components/map-section'
import { JurySection } from '@/components/jury-section'
import { CtaSection } from '@/components/cta-section'
import { Footer } from '@/components/footer'

// Renders per request so a new submission shows up without a redeploy.
export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <>
      <SplashScreen />
      {/* Wrapped so SplashScreen can mark it inert while it covers the
          screen — otherwise keyboard/AT users could Tab into content
          that's hidden behind the splash but still in the DOM. */}
      <div id="site-content">
        <SiteHeader />
        <main>
          <HeroSection />
          <div aria-hidden className="torn-top h-10 w-full bg-collage-blue sm:h-14" />
          <ParticipationStatus />
          <BasesBanner />
          <EditionSection />
          <HowToSection />
          <AboutSection />
          <ParticipantsSection />
          <MapSection />
          <JurySection />
          <CtaSection />
          <WorkshopSection />
        </main>
        <Footer />
      </div>
    </>
  )
}
