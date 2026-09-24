import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'

const stepStyles = [
  { number: '01', color: 'bg-collage-blue' },
  { number: '02', color: 'bg-collage-red' },
  { number: '03', color: 'bg-collage-yellow' },
]

export async function HowToSection() {
  const { m } = await getI18n()
  const steps = stepStyles.map((style, i) => ({ ...style, ...m.howTo.steps[i] }))
  return (
    <section id="como-participar" className="border-t-2 border-ink/10 bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
            {m.howTo.eyebrow}
          </p>
          <h2 className="font-display mt-3 text-center text-3xl tracking-tight uppercase sm:text-4xl">
            {m.howTo.title}
          </h2>
        </FadeIn>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 120}>
              <div className="relative h-full rounded-2xl border-2 border-ink/10 bg-background p-7">
                <span
                  className={`torn-top absolute -top-4 left-6 inline-block px-3 py-1 text-xs font-black text-primary-foreground ${step.color} ${i % 2 === 0 ? 'rotate-[-3deg]' : 'rotate-2'}`}
                >
                  {step.number}
                </span>
                <h3 className="mt-6 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={400}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" variant="primary">
              <Link href="/onboarding">{m.howTo.register}</Link>
            </Button>
            <a
              href={`mailto:${site.email}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
            >
              {m.howTo.byEmail}
            </a>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            {m.howTo.googleWhy}
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
