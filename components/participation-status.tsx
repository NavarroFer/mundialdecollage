import Link from 'next/link'
import { AlertCircle, ArrowRight, Award, CheckCircle2, Download, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { TrackedLink, TrackView } from '@/components/track'
import { CountrySelect } from '@/components/ui/country-select'
import { SubmitButton } from '@/components/admin/submit-button'
import { ShareArtwork } from '@/components/share-artwork'
import { MagazinePromo } from '@/components/store-promo'
import { getCallState, isCallOpen } from '@/lib/call-state'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { countryCodeToName, getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { completeMissingDetails } from '@/app/[locale]/(site)/onboarding/actions'
import { getArtworkShareState } from '@/lib/finalists'
import { countReferrals } from '@/lib/referral-server'
import { plural } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import type { Messages } from '@/lib/i18n/messages'
import { imageSrc } from '@/lib/image-src'

// Shown right under the hero to anyone signed in (admins excepted — they
// never submit an artwork, see lib/admin.ts). A returning, already-submitted
// artist sees "Ya estás participando" with their obra — and, if Registro
// loaded it for them, a prompt to confirm their details. Someone who signed
// in without finishing (e.g. with Google, to like an obra in the 3D gallery)
// is asked to finish their sign-up instead. Logged-out visitors see nothing.
export async function ParticipationStatus() {
  if (!isSupabaseConfigured) return null

  const { locale, m } = await getI18n()
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null
  if (ADMIN_EMAILS.includes(user.email ?? '')) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded_at, country_code, details_confirmed_at, name')
    .eq('id', user.id)
    .maybeSingle()

  // A read error must not look like "never signed up" and nag a real artist.
  if (profileError) return null
  // «Terminá tu inscripción» only while there's still a call to finish it for.
  if (!profile?.onboarded_at) return (await isCallOpen()) ? <FinishSignUp m={m} /> : null

  // The artwork this artist is currently represented by — see
  // supabase/migrations/20260921040000_artworks.sql. Not necessarily set:
  // it's technically possible (though it shouldn't happen in practice, since
  // a first submission always auto-selects) for a profile to have artwork
  // rows with none of them selected yet, e.g. right after an admin-curated
  // resubmission. Rendering nothing in that edge case matches the previous
  // defensive "don't show a broken card" behavior.
  const { data: artwork } = await supabase
    .from('artworks')
    .select('title, slug, image_url, technique, legacy_submission_id')
    .eq('profile_id', user.id)
    .eq('is_selected', true)
    .maybeSingle()

  if (!artwork) return null
  // How many artists signed up through this one's shared links
  // (lib/referral.ts) — shown next to the share buttons, as the reason to
  // keep sharing.
  const [{ isPublic }, referrals] = await Promise.all([getArtworkShareState(artwork.slug), countReferrals(user.id)])

  // /admin/obras can publish a legacy submission with no país (the
  // free-text import couldn't guess one) rather than block on it — this is
  // where that gets asked for real, along with técnica since the legacy
  // import never captured that either. See completeMissingDetails.
  // Registro loaded this obra and its details for them (legacy_submission_id)
  // — until they confirm name and country themselves (confirmArtistDetails),
  // ask them to. That review covers the country too, so it replaces the
  // country form below.
  // An obra without a title (the sheet had none, or had a wrong one) is
  // completed from the same review page.
  const needsTitle = !artwork.title?.trim()
  const needsConfirmation = needsTitle || (Boolean(artwork.legacy_submission_id) && !profile.details_confirmed_at)
  const needsCountry = !needsConfirmation && !profile.country_code
  // Certificates are handed out once the call closes (/admin/convocatoria).
  const certificatesReady = !(await getCallState()).open
  const countries = needsCountry
    ? getAllCountryCodes()
        .map((code) => ({ code, name: countryCodeToName(code, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale))
    : []

  return (
    <section className="border-t-2 border-ink/10 bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <div className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card p-5 sm:flex-row sm:gap-8 sm:p-6">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border-2 border-ink/10 bg-muted sm:w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc(artwork.image_url, 384)}
                alt={artwork.title ?? m.common.untitled}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              {/* Until they confirm, don't tell them they're already in — a
                  "Ya estás participando" badge above the prompt read as done,
                  and almost nobody tapped it. */}
              {needsConfirmation ? (
                <span className="torn-strip inline-flex -rotate-1 items-center gap-1.5 bg-collage-red px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {m.status.pendingBadge}
                </span>
              ) : (
                <span className="torn-strip inline-flex -rotate-1 items-center gap-1.5 bg-collage-blue px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {m.status.badge}
                </span>
              )}

              <h2 className="font-display mt-4 text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {artwork.title ?? m.common.untitled}
              </h2>

              {!needsConfirmation && (
                <p className="mt-2 text-muted-foreground">
                  {m.status.body}
                </p>
              )}

              {needsConfirmation && (
                <div className="mt-4 rounded-xl border-2 border-collage-red/30 bg-collage-red/5 p-4 text-left">
                  <p className="font-semibold text-ink">{needsTitle ? m.status.titleMissingTitle : m.status.confirmTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{needsTitle ? m.status.titleMissingBody : m.status.confirmBody}</p>
                  <TrackView event="signup_prompt_view" />
                  <TrackedLink href="/onboarding" event="signup_prompt_click" className="mt-3 inline-block">
                    <Button className="gap-2">
                      {needsTitle ? m.status.titleMissingCta : m.status.confirmCta}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TrackedLink>
                </div>
              )}

              {needsCountry && (
                <form
                  action={completeMissingDetails}
                  className="mt-4 rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 p-4 text-left"
                >
                  <p className="text-sm font-medium text-ink">
                    {m.status.needCountry}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <CountrySelect name="country_code" countries={countries} required />
                    <select
                      name="technique"
                      defaultValue=""
                      className="mt-1.5 rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm text-ink outline-none focus:border-collage-blue sm:mt-0"
                    >
                      <option value="">{m.status.techniqueOptional}</option>
                      {TECHNIQUES.map((technique) => (
                        <option key={technique} value={technique}>
                          {m.common.techniques[technique] ?? technique}
                        </option>
                      ))}
                    </select>
                    <SubmitButton pendingLabel={m.common.saving} className="sm:mt-0">
                      {m.common.save}
                    </SubmitButton>
                  </div>
                </form>
              )}

              {certificatesReady && !needsConfirmation && (
                <div className="mt-5 rounded-xl border-2 border-collage-yellow/40 bg-collage-yellow/10 p-4 text-left">
                  <p className="flex items-center gap-2 font-semibold text-ink"><Award className="h-5 w-5 text-collage-red" aria-hidden="true" />{m.certificate.sectionTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.certificate.sectionBody}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    <a href={`/obras/${artwork.slug}/certificado?formato=pdf`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-collage-blue underline underline-offset-4">
                      <Download className="h-4 w-4" aria-hidden="true" />{m.certificate.downloadPdf}
                    </a>
                    <a href={`/obras/${artwork.slug}/certificado?formato=imagen`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-collage-blue underline underline-offset-4">
                      <Download className="h-4 w-4" aria-hidden="true" />{m.certificate.downloadImage}
                    </a>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
                <Link href={`/obras/${artwork.slug}`}>
                  <Button variant="outline" className="gap-2">
                    {m.common.viewMyArtwork}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/onboarding?another=1">
                  <Button variant="outline" className="gap-2">
                    {m.common.sendAnother}
                  </Button>
                </Link>
              </div>

              {referrals > 0 && (
                <div className="mt-6 flex items-start gap-3 rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 p-4 text-left">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-collage-blue" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-ink">{plural(locale, referrals, m.referral.joined)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.referral.joinedBody}</p>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <ShareArtwork
                  slug={artwork.slug}
                  title={artwork.title?.trim() || m.common.untitled}
                  name={profile.name ?? ''}
                  isPublic={isPublic}
                  isOwn
                />
              </div>
            </div>
          </div>
          {/* Every artist is in the magazine's index — once they're in for
              real (confirmed), the pre-sale is for them. */}
          {!needsConfirmation && <MagazinePromo m={m} event="magazine_click_status" className="mt-4" />}
        </FadeIn>
      </div>
    </section>
  )
}

// Signed in (e.g. with Google from the 3D gallery) but never submitted: the
// onboarding page takes it from here — it also recognizes an artist whose
// obra was already sent in some other way and only asks them to confirm.
function FinishSignUp({ m }: { m: Messages }) {
  return (
    <section className="border-t-2 border-ink/10 bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <div className="rounded-2xl border-2 border-ink/10 bg-card p-6 text-center sm:p-8 sm:text-left">
            <span className="torn-strip inline-flex -rotate-1 items-center gap-1.5 bg-collage-red px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
              {m.status.finishBadge}
            </span>
            <h2 className="font-display mt-4 text-2xl tracking-tight text-ink uppercase sm:text-3xl">{m.status.joinTitle}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{m.status.joinBody}</p>
            <TrackView event="signup_prompt_view" />
            <TrackedLink href="/onboarding" event="signup_prompt_click" className="mt-5 inline-block">
              <Button className="gap-2">
                {m.status.joinCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TrackedLink>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
