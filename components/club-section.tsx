import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { isClubOpen } from '@/lib/club-launch'
import { getI18n } from '@/lib/i18n/server'

// A banner on the home, between the store and the obras: it points to /club
// and takes well under a screen. Same for everyone, so the home keeps its
// anonymous copy.
export async function ClubSection() {
  if (!isClubOpen()) return null
  const { m } = await getI18n()
  const t = m.clubLanding
  return (
    <section className="mx-auto max-w-4xl px-5 pt-10 sm:px-8 sm:pt-14" aria-labelledby="club-home-title">
      <FadeIn>
        <div className="rounded-3xl border-2 border-ink/10 bg-collage-blue/5 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">{t.homeEyebrow}</p>
            <h2 id="club-home-title" className="font-display mt-2 text-2xl tracking-tight text-ink uppercase sm:text-3xl">{t.homeTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t.homeBody}</p>
          </div>
          <Link href="/club" className="mt-5 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-6 font-bold text-white sm:mt-0">
            {t.homeCta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </FadeIn>
    </section>
  )
}
