import { CalendarDays, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'

export function WorkshopSection() {
  return (
    <section id="taller" className="relative overflow-hidden border-t-2 border-ink/10 bg-card py-20 sm:py-28">
      <Scissors
        className="pointer-events-none absolute -right-6 -bottom-10 h-40 w-40 rotate-12 text-collage-blue/10"
        strokeWidth={1}
      />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block rotate-2 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            Taller de collage
          </span>
        </FadeIn>

        <FadeIn delay={100}>
          <h2 className="font-display mt-7 text-3xl tracking-tight text-ink uppercase sm:text-5xl">
            {site.workshop.slogan}
          </h2>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            Un taller práctico para llegar con obra lista — o casi — antes del cierre
            de la convocatoria.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-background px-4 py-2 font-semibold text-ink">
              <CalendarDays className="h-4 w-4 text-collage-blue" />
              {site.workshop.dateLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-background px-4 py-2 font-semibold text-ink">
              {site.workshop.priceLabel}
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <a href={`mailto:${site.email}?subject=Quiero anotarme al taller`} className="mt-9 inline-block">
            <Button size="lg">Quiero anotarme</Button>
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            Cupos e inscripción con pago online, muy pronto.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
