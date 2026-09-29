import { CheckCircle2, ImageUp, LogIn } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { SubmitArtworkCta } from '@/components/submit-artwork-cta'
import { getI18n } from '@/lib/i18n/server'

export async function ParticipationGuide() {
  const { m } = await getI18n()
  const steps = [
    {
      icon: LogIn,
      title: m.auth.signIn,
      body: m.onboarding.signInBody,
      accent: 'bg-collage-blue text-primary-foreground',
    },
    {
      icon: ImageUp,
      title: m.onboarding.formEyebrow,
      body: m.onboarding.signInNeeds,
      accent: 'bg-collage-yellow text-ink',
    },
    {
      icon: CheckCircle2,
      title: m.onboarding.confirmParticipation,
      body: m.confirmation.doneNext,
      accent: 'bg-collage-red text-primary-foreground',
    },
  ]

  return (
    <section className="bg-grain relative overflow-hidden border-y-2 border-ink/10 bg-card py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
              {m.bases.eyebrow}
            </p>
            <h2 className="font-display mt-4 text-4xl tracking-tight text-ink uppercase sm:text-5xl">
              {m.onboarding.formTitle}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              {m.onboarding.formBody}
            </p>
          </div>
        </FadeIn>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.title}>
                <FadeIn delay={100 + index * 100} className="h-full">
                  <article className="relative h-full border-2 border-ink bg-background p-6 shadow-[6px_6px_0_var(--ink)] sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`flex size-12 items-center justify-center rounded-full ${step.accent}`}>
                        <Icon className="size-6" aria-hidden="true" />
                      </span>
                      <span className="font-display text-4xl text-ink/15" aria-hidden="true">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-ink">{step.title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{step.body}</p>
                  </article>
                </FadeIn>
              </li>
            )
          })}
        </ol>

        <FadeIn delay={450}>
          <div className="mx-auto mt-12 max-w-3xl border-l-4 border-collage-blue bg-collage-blue/5 p-6 sm:p-8">
            <p className="font-semibold leading-relaxed text-ink">{m.footer.googleWhy}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.confirmation.emailUse}</p>
          </div>
        </FadeIn>

        <FadeIn delay={550}>
          <div className="mt-10 flex justify-center">
            <SubmitArtworkCta event="submit_click_guide" />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
