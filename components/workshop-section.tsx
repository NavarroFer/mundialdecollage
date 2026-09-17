import Link from 'next/link'
import { CalendarDays, MapPin, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { site } from '@/lib/site'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

// Async so it can check the session server-side before deciding whether the
// CTA can go straight to the registration flow or has to sign the visitor
// in first — same pattern as AuthSlot in components/site-header.tsx.
async function WorkshopCta() {
  let isLoggedIn = false
  if (isSupabaseConfigured) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isLoggedIn = Boolean(user)
  }

  if (isLoggedIn) {
    return (
      <Link href="/taller/inscripcion" className="mt-9 inline-block">
        <Button size="lg">Quiero anotarme</Button>
      </Link>
    )
  }

  return (
    <div className="mt-9 inline-block">
      <GoogleSignInButton next="/taller/inscripcion" />
    </div>
  )
}

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
              <MapPin className="h-4 w-4 text-collage-red" />
              {site.workshop.locationLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-background px-4 py-2 font-semibold text-ink">
              {site.workshop.priceLabel}
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <WorkshopCta />
          <p className="mt-4 text-xs text-muted-foreground">
            Cupos limitados — inscripción con pago online (seña o total).
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
