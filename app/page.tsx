import { SiteHeader } from '@/components/site-header'
import { HeroSection } from '@/components/hero-section'
import { BasesBanner } from '@/components/bases-banner'
import { HowToSection } from '@/components/how-to-section'
import { AboutSection } from '@/components/about-section'
import { WorkshopSection } from '@/components/workshop-section'
import { ParticipantsSection } from '@/components/participants-section'
import { JurySection } from '@/components/jury-section'
import { CtaSection } from '@/components/cta-section'
import { Footer } from '@/components/footer'

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <BasesBanner />
        <HowToSection />
        <AboutSection />
        <WorkshopSection />
        <ParticipantsSection />
        <JurySection />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
