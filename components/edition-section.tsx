import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/track'
import { FadeIn } from '@/components/fade-in'
import { getSubmissionsCount } from '@/lib/submissions'
import { getI18n } from '@/lib/i18n/server'
import { formatNumber, plural } from '@/lib/i18n/format'

export async function EditionSection() {
  const [submissionsCount, { locale, m }] = await Promise.all([getSubmissionsCount(), getI18n()])
  const hasSubmissions = submissionsCount > 0

  return (
    <section id="primera-edicion" className="bg-grain relative overflow-hidden border-t-2 border-ink/10 bg-collage-yellow py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className="torn-strip inline-block -rotate-1 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            {m.edition.badge}
          </span>
        </FadeIn>

        <FadeIn delay={100}>
          <p className="mt-6 text-xs font-bold tracking-[0.2em] text-ink/80 uppercase sm:text-sm">
            {m.edition.eyebrow}
          </p>
        </FadeIn>

        <FadeIn delay={150}>
          <h2 className="font-display mt-2 flex flex-col items-center gap-2 text-ink">
            {hasSubmissions ? (
              <>
                <span className="text-3xl uppercase sm:text-5xl">{m.edition.received}</span>
                <span className="my-3 inline-block -rotate-3 bg-paper px-6 py-3 text-8xl leading-none tracking-tight text-collage-red shadow-[6px_6px_0_var(--color-ink)] sm:px-10 sm:text-9xl">
                  {formatNumber(locale, submissionsCount)}
                </span>
                <span className="text-4xl uppercase sm:text-6xl">
                  {plural(locale, submissionsCount, m.edition.artworks)}
                </span>
              </>
            ) : (
              <span className="text-3xl uppercase tracking-tight sm:text-4xl">{m.edition.open}</span>
            )}
          </h2>
        </FadeIn>

        <FadeIn delay={300}>
          <p className="font-display mx-auto mt-6 max-w-xl text-2xl uppercase text-ink sm:text-3xl">
            {m.edition.tagline}
          </p>
          <p className="mx-auto mt-3 max-w-md text-ink/80">
            {m.edition.sub}
          </p>
        </FadeIn>

        <FadeIn delay={400}>
          <div className="mt-8 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Button asChild size="lg" variant="primary">
              <TrackedLink href="/onboarding" event="submit_click_edition">{m.edition.submit}</TrackedLink>
            </Button>
            <Link href="#participantes" className="text-sm font-semibold text-collage-blue underline underline-offset-4">
              {m.edition.discover}
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
