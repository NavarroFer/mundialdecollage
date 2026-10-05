import { ArrowLeft, Scissors } from 'lucide-react'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'

export default async function NotFound() {
  const { m } = await getI18n()
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-grain relative overflow-hidden py-24 sm:py-32">
          {/* decorative dots, echoing the flyers' color-block circles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-24 -left-10 h-28 w-28 rounded-full bg-collage-red/90 sm:top-32 sm:left-[6%]" />
            <div className="absolute top-10 right-[8%] h-16 w-16 rounded-full bg-collage-yellow sm:top-16" />
            <div className="animate-float-slow absolute bottom-16 left-[12%] h-10 w-10 rounded-full bg-collage-blue/80 [--rot:-8deg]" />
            <Scissors
              className="animate-float-slow absolute right-[10%] bottom-24 h-10 w-10 text-ink/20 [--rot:18deg] sm:h-14 sm:w-14"
              strokeWidth={1.5}
            />
          </div>

          <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block -rotate-2 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
              {m.notFound.badge}
            </span>

            <h1 className="font-display mt-8 text-7xl leading-[0.9] tracking-tight text-ink uppercase sm:text-8xl md:text-9xl">
              <span className="text-collage-red">4</span>
              <span className="text-collage-blue">0</span>
              <span className="text-collage-red">4</span>
            </h1>

            <p className="mx-auto mt-7 max-w-md text-lg text-muted-foreground sm:text-xl">
              {m.notFound.body}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/">
                <Button size="lg" className="gap-2">
                  <ArrowLeft className="h-5 w-5" />
                  {m.common.backHome}
                </Button>
              </Link>
              <a href={`mailto:${site.email}`}>
                <Button size="lg" variant="outline">
                  {m.notFound.writeUs}
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
