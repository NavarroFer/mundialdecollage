import { Globe2, Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { getI18n } from '@/lib/i18n/server'

export async function JurySection() {
  const { m } = await getI18n()
  return (
    <section className="bg-grain relative overflow-hidden border-t-2 border-ink/10 bg-collage-blue py-20 text-primary-foreground sm:py-28">
      <Globe2
        className="pointer-events-none absolute -right-10 -bottom-16 h-56 w-56 text-primary-foreground/10 sm:h-72 sm:w-72"
        strokeWidth={1}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 md:grid-cols-2 md:items-center">
        <FadeIn direction="right">
          <p className="text-sm font-bold tracking-[0.25em] text-collage-yellow uppercase">
            {m.jury.eyebrow}
          </p>
          <h2 className="font-display mt-3 text-3xl leading-[1.05] tracking-tight uppercase sm:text-4xl">
            {m.jury.title1}
            <br />
            {m.jury.title2}
          </h2>
          <p className="mt-5 max-w-md text-primary-foreground/75">
            {m.jury.body}
          </p>
        </FadeIn>

        <FadeIn direction="left" delay={150}>
          <div className="ml-auto w-full max-w-sm rounded-2xl border-2 border-primary-foreground/20 bg-primary-foreground/10 p-8 text-center backdrop-blur-sm">
            <Sparkles className="mx-auto h-8 w-8 text-collage-yellow" strokeWidth={1.5} />
            <p className="font-display mt-4 text-2xl tracking-wide uppercase">{m.jury.prizes}</p>
            <div className="mt-5 space-y-4 text-left">
              <div>
                <p className="font-display text-lg tracking-wide text-collage-yellow uppercase">
                  {m.jury.showTitle}
                </p>
                <p className="mt-1 text-sm text-primary-foreground/70">
                  {m.jury.showBody}
                </p>
              </div>
              <div>
                <p className="font-display text-lg tracking-wide text-collage-yellow uppercase">
                  {m.jury.magazineTitle}
                </p>
                <p className="mt-1 text-sm text-primary-foreground/70">
                  {m.jury.magazineBody}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
