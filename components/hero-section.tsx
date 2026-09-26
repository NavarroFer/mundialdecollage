import Image from 'next/image'
import { Scissors } from 'lucide-react'
import { SubmitArtworkCta } from '@/components/submit-artwork-cta'
import { Countdown } from '@/components/countdown'
import { ArtworkSearch } from '@/components/artwork-search'
import { FadeIn } from '@/components/fade-in'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'
import { fmt, formatDayMonth, plural } from '@/lib/i18n/format'
import { getSubmissionsCount } from '@/lib/submissions'
import { getFinalists } from '@/lib/finalists'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

// The search's sign-up invite is only for visitors without a session.
async function isSignedIn() {
  if (!isSupabaseConfigured) return false
  const { data: { user } } = await (await createClient()).auth.getUser()
  return Boolean(user)
}

export async function HeroSection() {
  const [{ locale, m }, signedIn, submissions, artworks] = await Promise.all([
    getI18n(),
    isSignedIn(),
    getSubmissionsCount(),
    getFinalists(),
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
          <span className="torn-strip inline-block -rotate-2 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            {m.hero.badge}
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
        <Scissors
          className="animate-float-slow absolute right-[10%] bottom-24 h-10 w-10 text-ink/20 [--rot:18deg] sm:h-14 sm:w-14"
          strokeWidth={1.5}
        />
      </div>

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
            {m.hero.intro}
          </p>
        </FadeIn>

        {submissions > 0 && countries > 0 && (
          <FadeIn delay={225}>
            <p className="mt-5 text-base font-semibold text-ink sm:text-lg">
              {fmt(m.hero.proof, {
                artworks: plural(locale, submissions, m.map.artworks),
                countries: plural(locale, countries, m.hero.countries),
              })}
            </p>
          </FadeIn>
        )}

        {/* z-20 keeps the open results above the CTA row and the dots. */}
        <FadeIn delay={250} className="relative z-20 mt-8">
          <ArtworkSearch signedIn={signedIn} />
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <SubmitArtworkCta />
            <Countdown />
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <p className="mt-6 text-sm font-semibold text-ink/80">
            {fmt(m.hero.free, { date: formatDayMonth(locale, site.deadlineISO) })}
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
