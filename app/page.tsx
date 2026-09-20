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
      <SiteHeader />
      <main>
        <HeroSection />
        <div aria-hidden className="torn-top h-10 w-full bg-collage-blue sm:h-14" />
        <ParticipationStatus />
        <BasesBanner />
        <EditionSection />
        <HowToSection />
        <AboutSection />
        <WorkshopSection />
        <ParticipantsSection />
        <MapSection />
        <JurySection />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
