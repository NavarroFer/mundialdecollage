import { FadeIn } from '@/components/fade-in'

const badges = ['Edición internacional', 'Jurado especializado', 'Comunidad de collagistas']

export function AboutSection() {
  return (
    <section className="relative overflow-hidden border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <FadeIn>
          <p className="text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
            Quiénes somos
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="font-display mt-5 -rotate-1 text-4xl tracking-tight text-ink uppercase sm:text-5xl">
            <span className="torn-strip inline-block bg-collage-yellow px-4 py-1">
              Hacer algo es logro
            </span>
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground">
            En collage, como en la vida, se trata de agarrar lo que tenés — recortes,
            restos, lo que sobró — y hacer algo entero con eso. Este Mundial existe
            para celebrar exactamente eso: la obra que se terminó, se mandó, se hizo.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {badges.map((badge, i) => (
              <span
                key={badge}
                className={`rounded-full border-2 border-ink/15 bg-card px-4 py-1.5 text-sm font-semibold text-ink ${i === 1 ? 'rotate-1' : '-rotate-1'}`}
              >
                {badge}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
