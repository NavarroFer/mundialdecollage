import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { SubmitButton } from '@/components/admin/submit-button'
import { CountrySelect } from '@/components/ui/country-select'
import { isAdminView } from '@/lib/view-mode'
import { instagramHandle } from '@/lib/instagram'
import { getI18n } from '@/lib/i18n/server'
import { artistProfileSlug } from '@/lib/artist-slug'
import { countryCodeToName, getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { saveProfile } from './actions'

const inputClass =
  'mt-1.5 w-full rounded-lg border-2 border-ink/15 bg-background px-4 py-2.5 text-sm outline-none focus:border-collage-blue'

// «Mis datos»: where an artist corrects what the site knows about them. Private
// (reads the session), so it is not one of lib/static-pages.ts. Everything is
// editable but the email, which is the account's.
export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; guardado?: string }> }) {
  if (!isSupabaseConfigured) redirect('/')
  const user = await getCurrentUser()
  if (!user) redirect('/onboarding')
  // Admins moderate, they don't submit (lib/admin.ts).
  if (await isAdminView(user)) redirect('/admin')

  const { locale, m } = await getI18n()
  const t = m.profileEditor
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: profile }, { data: artworks }] = await Promise.all([
    supabase.from('profiles').select('name, country_code, instagram, website').eq('id', user.id).maybeSingle(),
    supabase
      .from('artworks')
      .select('id, title, technique, image_url')
      .eq('profile_id', user.id)
      .eq('is_club_only', false)
      .is('archived_at', null)
      .is('duplicate_of', null)
      .order('is_selected', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  // Nothing to edit until they have signed up.
  if (!profile) redirect('/onboarding')

  const countries = getAllCountryCodes()
    .map((code) => ({ code, name: countryCodeToName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  const error = params.error ? t.errors[params.error] ?? t.errors.save_failed : undefined
  const profileHref = profile.name ? `/artistas/${artistProfileSlug(profile.name, user.id)}` : undefined

  return (
    <main className="bg-grain min-h-screen px-5 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="font-display text-3xl uppercase text-ink sm:text-4xl">{t.title}</h1>
        <p className="mt-4 text-muted-foreground">{t.intro}</p>

        {params.guardado && (
          <p role="status" className="mt-6 flex items-center gap-2 rounded-lg bg-collage-blue/10 p-3 text-sm font-semibold text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-collage-blue" aria-hidden="true" />
            {t.saved}
          </p>
        )}
        {error && <p role="alert" className="mt-6 rounded-lg bg-collage-red/10 p-3 text-sm text-collage-red-ink">{error}</p>}

        <form action={saveProfile} className="mt-8 space-y-8 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card p-6 shadow-sm sm:p-8">
          <section className="space-y-4">
            <h2 className="font-semibold text-ink">{t.you}</h2>
            <div>
              <label htmlFor="name" className="text-sm font-semibold text-ink">{m.onboarding.name}</label>
              <input id="name" name="name" type="text" required maxLength={120} defaultValue={profile.name ?? ''} autoComplete="name" className={inputClass} />
              <p className="mt-1.5 text-xs text-muted-foreground">{t.nameHint}</p>
            </div>
            <div>
              <label htmlFor="country_code" className="text-sm font-semibold text-ink">{m.onboarding.country}</label>
              <CountrySelect id="country_code" name="country_code" countries={countries} defaultValue={profile.country_code ?? ''} required />
            </div>
            <div>
              <label htmlFor="instagram" className="text-sm font-semibold text-ink">
                Instagram <span className="font-normal text-muted-foreground">{m.common.optional}</span>
              </label>
              <input
                id="instagram"
                name="instagram"
                type="text"
                defaultValue={instagramHandle(profile.instagram) ? `@${instagramHandle(profile.instagram)}` : ''}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={m.onboarding.instagramPlaceholder}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="website" className="text-sm font-semibold text-ink">
                {m.common.website} <span className="font-normal text-muted-foreground">{m.common.optional}</span>
              </label>
              {/* Not type="url": the browser would refuse "misitio.com" in its own words. */}
              <input
                id="website"
                name="website"
                type="text"
                inputMode="url"
                defaultValue={profile.website ?? ''}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{m.onboarding.accountEmail}</p>
              <p className="mt-1.5 break-all rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-ink/80">{user.email}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{t.emailFixed}</p>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="font-semibold text-ink">{t.obras}</h2>
            {(artworks ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t.noObras}</p>}
            {(artworks ?? []).map((artwork, index) => (
              <div key={artwork.id} className="flex gap-4 rounded-xl border-2 border-ink/10 p-4">
                <input type="hidden" name="artwork_id" value={artwork.id} />
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-paper">
                  <Image src={artwork.image_url} alt="" fill sizes="96px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <label htmlFor={`title-${index}`} className="text-sm font-semibold text-ink">{m.onboarding.artworkTitle}</label>
                    <input id={`title-${index}`} name="artwork_title" type="text" required maxLength={200} defaultValue={artwork.title ?? ''} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`technique-${index}`} className="text-sm font-semibold text-ink">
                      {m.onboarding.technique} <span className="font-normal text-muted-foreground">{m.common.optional}</span>
                    </label>
                    <select id={`technique-${index}`} name="technique" defaultValue={artwork.technique ?? ''} className={inputClass}>
                      <option value="">{m.onboarding.techniqueNone}</option>
                      {TECHNIQUES.map((technique) => (
                        <option key={technique} value={technique}>{m.common.techniques[technique] ?? technique}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <SubmitButton size="lg" pendingLabel={m.common.saving} className="h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-center">
            {t.save}
          </SubmitButton>
        </form>

        {profileHref && (
          <Link href={profileHref} prefetch={false} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-collage-blue underline underline-offset-4">
            {m.common.viewMyProfile}
          </Link>
        )}
      </div>
    </main>
  )
}
