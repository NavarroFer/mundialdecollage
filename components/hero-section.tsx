import Image from 'next/image'
import { SubmitArtworkCta } from '@/components/submit-artwork-cta'
import { AnimatedParticipationProof } from '@/components/animated-participation-proof'
import { HeroScissors } from '@/components/hero-scissors'
import { Countdown } from '@/components/countdown'
import { ArtworkSearch } from '@/components/artwork-search'
import { FadeIn } from '@/components/fade-in'
import { TrackVisible } from '@/components/track'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'
import { fmt, formatDayMonth } from '@/lib/i18n/format'
import { getFinalists } from '@/lib/finalists'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/supabase/server'
import { getCallState } from '@/lib/call-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// The search's sign-up invite is only for visitors without a session.
async function isSignedIn() {
  if (!isSupabaseConfigured) return false
  return Boolean(await getCurrentUser())
}

export async function HeroSection() {
  const [{ locale, m }, signedIn, artworks, { open }] = await Promise.all([
    getI18n(),
    isSignedIn(),
    getFinalists(),
    getCallState(),
  ])
  // Live, like the edition banner and the map: every obra received, and the
  // countries of the published ones (the same flags the ribbon below shows).
  const countries = new Set(artworks.flatMap((artwork) => (artwork.countryCode ? [artwork.countryCode] : []))).size
  return (
    // No overflow-hidden here: the search's results hang below the hero. The
    // decorations clip themselves (their own overflow-hidden layer below).
    <section id="top" className="bg-grain relative pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <FadeIn>
          <span className={`torn-strip inline-block -rotate-2 px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm ${open ? 'bg-collage-blue' : 'bg-collage-red'}`}>
            {open ? m.hero.badge : m.closed.badge}
          </span>
        </FadeIn>

        <h1 className="sr-only">{m.meta.title}</h1>
      </div>

      {/* decorative dots, echoing the flyers' color-block circles. FadeIn
          puts a `transform` on the video's wrapper below, which gives it its
          own z-index:auto stacking context — among same-priority (auto)
          stacking contexts, painting follows DOM order, so without help the
          later, opaque video paints over these. Only the red/yellow dots
          actually sit near the video, so only they get an explicit z-index
          to win that fight; the blue dot and scissors sit near the bottom of
          the section and must stay z-index:auto so the footer text after
          them (also z-index:auto, later in the DOM) keeps painting on top —
          giving the whole overlay a z-index previously covered that text.
          The blue dot is also anchored off the left edge (like the red
          circle) rather than at a `%` position — a percentage can land it
          in the centered footer text's column at some viewport widths even
          though the text wins the paint order, since a same-color-family
          dot sitting right behind/beside the text still reads as "covering"
          it. Off-canvas-edge placement keeps it clear of the padded text
          column (px-5+) at every width instead of relying on one path. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-3 -left-14 z-10 h-24 w-24 rounded-full bg-collage-red/90 sm:top-32 sm:left-[6%] sm:h-28 sm:w-28" />
        <div className="absolute top-10 right-[8%] z-10 h-16 w-16 rounded-full bg-collage-yellow sm:top-16" />
        <div className="animate-float-slow absolute -left-4 bottom-16 h-10 w-10 rounded-full bg-collage-blue/80 [--rot:-8deg] sm:left-[12%]" />
      </div>
      <HeroScissors />

      {/* Horizontal lockup (isotipo + wordmark), per the brand guide's
          "para el encabezado web y espacios apaisados" composition — now
          the hero's centerpiece since header.mp4 moved to the splash
          screen (components/splash-screen.tsx) instead of playing here too. */}
      <FadeIn delay={100}>
        <div className="mx-auto mt-8 flex max-w-[48.3rem] items-center justify-center gap-5 px-5 sm:gap-8 sm:px-8">
          <Image
            src="/logo-mark.png"
            alt=""
            width={512}
            height={512}
            className="h-24 w-24 shrink-0 sm:h-36 sm:w-36"
          />
          {/* min-w-0 overrides the flex item's default automatic minimum
              size, which otherwise floors at max-w-sm/md and blows out the
              row past narrow viewports instead of actually shrinking. */}
          <Image
            src="/wordmark.png"
            alt="Mundial de Collage"
            width={949}
            height={322}
            className="h-auto w-full min-w-0 max-w-sm sm:max-w-md"
          />
        </div>
      </FadeIn>

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <FadeIn delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground sm:text-xl">
            {open ? m.hero.intro : m.closed.intro}
          </p>
        </FadeIn>

        {artworks.length > 0 && countries > 0 && (
          <FadeIn delay={225}>
            <AnimatedParticipationProof artworks={artworks.length} countries={countries} />
          </FadeIn>
        )}

        <FadeIn delay={250}>
          {/* Once the call closes (/admin/convocatoria) the way in is the
              gallery: no countdown, no «free until». */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {open ? (
              <>
                <TrackVisible event="hero_cta_view" />
                <SubmitArtworkCta />
                <Countdown />
              </>
            ) : (
              <Button asChild size="lg" variant="primary" className="h-auto min-h-14 px-8 text-base">
                <Link href="/galeria-3d">{m.closed.cta}</Link>
              </Button>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mx-auto mt-5 max-w-2xl">
            {open ? (
              <>
                <p className="text-sm font-bold text-ink">
                  {fmt(m.hero.free, { date: formatDayMonth(locale, site.deadlineISO) })}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {m.onboarding.signInNeeds}
                </p>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{m.closed.note}</p>
            )}
          </div>
        </FadeIn>

        {/* The artwork directory supports discovery, but sits after the
            participation action so it cannot compete with the open call's
            primary next step. z-20 keeps its open results above the dots. */}
        <FadeIn delay={400} className="relative z-20 mt-10 border-t-2 border-ink/10 pt-8">
          <ArtworkSearch signedIn={signedIn} />
        </FadeIn>
      </div>
    </section>
  )
}
