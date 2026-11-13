import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Compass, Images, Search, CheckCircle2 } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Button } from '@/components/ui/button'
import { TrackedLink } from '@/components/track'
import { ShareArtwork } from '@/components/share-artwork'
import { getArtworkShareState } from '@/lib/finalists'
import { artistProfileSlug } from '@/lib/artist-profiles'
import { getI18n } from '@/lib/i18n/server'
import { MagazinePromo, PromoCard, StorePromo } from '@/components/store-promo'
import { isClubOpen } from '@/lib/club-launch'
import { Building2 } from 'lucide-react'
import { OnboardingSteps } from '../onboarding-steps'

export default async function ConfirmationPage() {
  if (!isSupabaseConfigured) redirect('/')
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/onboarding')
  const { data: artwork } = await supabase.from('artworks').select('slug, title')
    .eq('profile_id', user.id).order('is_selected', { ascending: false })
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!artwork) redirect('/onboarding')
  const [{ m }, { isPublic }, { data: profile }] = await Promise.all([
    getI18n(),
    getArtworkShareState(artwork.slug),
    supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
  ])
  // Their profile is the next stop: public once approved, a preview until then.
  const profileHref = profile?.name ? `/artistas/${artistProfileSlug(profile.name, user.id)}` : null

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl border-2 border-ink/10 bg-card p-8 text-center">
        <OnboardingSteps current="confirmation" m={m} />
        <CheckCircle2 className="mx-auto size-12 text-collage-blue" aria-hidden="true" />
        <h1 className="font-display mt-5 text-3xl text-ink">{m.confirmation.doneTitle}</h1>
        <p className="mt-4 text-muted-foreground">{m.confirmation.doneBody}</p>
        <p className="mt-3 text-sm text-muted-foreground">{m.confirmation.doneNext}</p>
        <div className="mt-7">
          <ShareArtwork slug={artwork.slug} title={artwork.title?.trim() || m.common.untitled} name="" isPublic={isPublic} isOwn />
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {profileHref && (
            <Button asChild size="lg"><TrackedLink href={profileHref} event="confirmation_profile_click">{m.common.viewMyProfile}</TrackedLink></Button>
          )}
          <Button asChild size="lg" variant={profileHref ? 'outline' : undefined}><Link href={`/obras/${artwork.slug}`}>{m.common.viewMyArtwork}</Link></Button>
          <Button asChild variant="outline"><Link href="/">{m.confirmation.backToMundial}</Link></Button>
        </div>
        <section className="mt-10 border-t-2 border-ink/10 pt-8 text-left" aria-labelledby="confirmation-overview-title">
          <h2 id="confirmation-overview-title" className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{m.confirmation.overviewTitle}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{m.confirmation.overviewBody}</p>
          <ul className="mt-5 grid gap-3">
            {[
              { href: '/explorar', title: m.siteSections.explore, body: m.siteSections.exploreLead, Icon: Search },
              { href: '/muestra', title: m.siteSections.show, body: m.siteSections.showLead, Icon: Images },
              { href: '/mundial', title: m.siteSections.mundial, body: m.siteSections.mundialLead, Icon: Compass },
            ].map(({ href, title, body, Icon }) => (
              <li key={href}>
                <Link href={href} className="group flex min-h-24 items-center gap-4 rounded-2xl border-2 border-ink/10 bg-paper p-4 text-left transition-colors hover:border-collage-blue/40 hover:bg-collage-blue/5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-collage-blue sm:p-5">
                  <Icon className="size-7 shrink-0 text-collage-blue" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold leading-snug text-ink">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{body}</span>
                    <span className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-collage-blue underline underline-offset-4">
                      {m.confirmation.overviewOpen}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {/* What to look forward to while the jury works, the Club first: a
            room of their own is the next step after a profile. */}
        <div className="mt-8 space-y-3">
          {isClubOpen() && (
            <PromoCard
              href="/club"
              event="club_click_confirmation"
              icon={Building2}
              eyebrow={m.clubLanding.homeEyebrow}
              title={m.clubLanding.homeTitle}
              body={m.clubLanding.homeBody}
              cta={m.clubLanding.homeCta}
            />
          )}
          <StorePromo m={m} event="store_click_confirmation" forArtist />
          <MagazinePromo m={m} event="magazine_click_confirmation" />
        </div>
      </div>
    </main>
  )
}
