import { FadeIn } from '@/components/fade-in'
import { getI18n } from '@/lib/i18n/server'

export async function AboutSection() {
  const { m } = await getI18n()
  return (
    <section className="relative overflow-hidden border-t-2 border-ink/10 bg-background py-20 sm:py-28">
      <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <FadeIn>
          <p className="text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
            {m.about.eyebrow}
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="font-display mt-5 -rotate-1 text-4xl tracking-tight text-ink uppercase sm:text-5xl">
            <span className="torn-strip inline-block bg-collage-yellow px-4 py-1">
              {m.about.motto}
            </span>
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground">
            {m.about.body}
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {m.about.badges.map((badge, i) => (
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
