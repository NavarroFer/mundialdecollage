import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/fade-in'
import { CountrySelect } from '@/components/ui/country-select'
import { SubmitButton } from '@/components/admin/submit-button'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { countryCodeToName, getAllCountryCodes } from '@/lib/participants'
import { completeMissingDetails } from '@/app/onboarding/actions'

// Shown right under the hero for a returning, already-submitted artist —
// "cuando esté logueado cada artista, que diga 'Ya estás participando' y les
// muestre su obra." Renders nothing for logged-out visitors, admins (they
// never submit an artwork, see lib/admin.ts), and logged-in users who
// haven't finished onboarding yet — that "you haven't submitted" case is
// intentionally out of scope here.
export async function ParticipationStatus() {
  if (!isSupabaseConfigured) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (ADMIN_EMAILS.includes(user.email ?? '')) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, country_code')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarded_at) return null

  // The artwork this artist is currently represented by — see
  // supabase/migrations/20260921040000_artworks.sql. Not necessarily set:
  // it's technically possible (though it shouldn't happen in practice, since
  // a first submission always auto-selects) for a profile to have artwork
  // rows with none of them selected yet, e.g. right after an admin-curated
  // resubmission. Rendering nothing in that edge case matches the previous
  // defensive "don't show a broken card" behavior.
  const { data: artwork } = await supabase
    .from('artworks')
    .select('title, slug, image_url, technique')
    .eq('profile_id', user.id)
    .eq('is_selected', true)
    .maybeSingle()

  if (!artwork) return null

  // /admin/obras can publish a legacy submission with no país (the
  // free-text import couldn't guess one) rather than block on it — this is
  // where that gets asked for real, along with técnica since the legacy
  // import never captured that either. See completeMissingDetails.
  const needsCountry = !profile.country_code
  const countries = needsCountry
    ? getAllCountryCodes()
        .map((code) => ({ code, name: countryCodeToName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <section className="border-t-2 border-ink/10 bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <FadeIn>
          <div className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card p-5 sm:flex-row sm:gap-8 sm:p-6">
            <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border-2 border-ink/10 bg-muted sm:w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artwork.image_url}
                alt={artwork.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="torn-strip inline-flex -rotate-1 items-center gap-1.5 bg-collage-blue px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ya estás participando
              </span>

              <h2 className="font-display mt-4 text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {artwork.title}
              </h2>

              <p className="mt-2 text-muted-foreground">
                Tu obra ya forma parte del Mundial de Collage.
              </p>

              {needsCountry && (
                <form
                  action={completeMissingDetails}
                  className="mt-4 rounded-xl border-2 border-collage-blue/20 bg-collage-blue/5 p-4 text-left"
                >
                  <p className="text-sm font-medium text-ink">
                    Nos falta tu país para mostrar tu obra en el mapa y el directorio.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <CountrySelect name="country_code" countries={countries} required />
                    <select
                      name="technique"
                      defaultValue=""
                      className="mt-1.5 rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm text-ink outline-none focus:border-collage-blue sm:mt-0"
                    >
                      <option value="">Técnica (opcional)</option>
                      <option value="Analógica">Analógica</option>
                      <option value="Mixta">Mixta</option>
                      <option value="Digital">Digital</option>
                    </select>
                    <SubmitButton pendingLabel="Guardando…" className="sm:mt-0">
                      Guardar
                    </SubmitButton>
                  </div>
                </form>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
                <Link href={`/obras/${artwork.slug}`}>
                  <Button variant="outline" className="gap-2">
                    Ver mi obra
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/onboarding?another=1">
                  <Button variant="outline" className="gap-2">
                    Enviar otra obra
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
