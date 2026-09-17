import { SiteHeader } from '@/components/site-header'
import { HeroSection } from '@/components/hero-section'
import { HowToSection } from '@/components/how-to-section'
import { JurySection } from '@/components/jury-section'
import { CtaSection } from '@/components/cta-section'
import { Footer } from '@/components/footer'

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <HowToSection />
        <JurySection />
        <CtaSection />
      </main>
      <Footer />
    </>
  )
}
