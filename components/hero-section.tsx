import { ArrowRight, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Countdown } from '@/components/countdown'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'

export function HeroSection() {
  return (
    <section id="top" className="bg-grain relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
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

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block -rotate-2 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            Convocatoria abierta
          </span>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="font-display mt-8 text-5xl leading-[0.95] tracking-tight uppercase sm:text-7xl md:text-8xl">
            <span className="text-collage-red">Mundial</span>
            <br />
            <span className="text-collage-blue">Internacional</span>
            <br />
            <span className="text-ink">de Collage</span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground sm:text-xl">
            El Mundial ya está sucediendo y queremos que tu obra sea parte. Jurado
            internacional, premios por anunciar.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href={`mailto:${site.email}`}>
              <Button size="lg" className="gap-2">
                Enviá tu obra
                <ArrowRight className="h-5 w-5" />
              </Button>
            </a>
            <Countdown />
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <p className="mt-6 text-sm text-muted-foreground">
            Hasta el {site.deadlineLabel} ·{' '}
            <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
              {site.email}
            </a>
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
