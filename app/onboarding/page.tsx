import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { fetchAndStoreLegacyArtwork } from '@/lib/legacy-submissions'
import { guessCountryCodeFromName } from '@/lib/participants'
import { OnboardingForm } from './onboarding-form'
import { completeOnboarding } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; another?: string }>
}) {
  if (!isSupabaseConfigured) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Admins log in to moderate, not to submit an artwork — skip the
  // onboarding form and drop them straight into the panel.
  if (ADMIN_EMAILS.includes(user.email ?? '')) redirect('/admin')

  const { error, another } = await searchParams

  // Before the real registration flow existed, ~90 artists already sent in
  // their collage by email — see supabase/migrations/20260919000000_legacy_
  // submissions.sql. Some sent more than one; an admin curates those down to
  // one `selected` row from /admin/obras, and only that curated row is ever
  // offered here. No match (including "not curated yet") is just the normal
  // blank-form path, not an error. Skipped entirely for a resubmission
  // (?another=1, linked from ParticipationStatus's "Enviar otra obra") —
  // that prefill only ever makes sense for someone's very first submission.
  let legacyName: string | null = null
  // Best-effort only, same guessCountryCodeFromName used to prefill the
  // admin's bulk-publish flow (app/admin/obras/actions.ts) — country_raw is
  // hand-salvaged free text, not a real ISO code, so this is undefined for
  // anything that doesn't cleanly match a real country name. Just a
  // suggested default on the form below, never written anywhere on its
  // own — the artist still has to confirm/pick it via CountrySelect.
  let legacyCountryCode: string | undefined
  let legacyImagePreview: { path: string; publicUrl: string } | null = null
  const email = !another ? user.email?.toLowerCase() : undefined
  if (email) {
    const { data: legacy } = await supabase
      .from('legacy_submissions')
      .select('id, name, country_raw, drive_url, image_path, image_url')
      .eq('email', email)
      .is('archived_at', null)
      .is('claimed_by', null)
      .eq('selected', true)
      .maybeSingle()

    if (legacy) {
      legacyName = legacy.name
      legacyCountryCode = legacy.country_raw ? guessCountryCodeFromName(legacy.country_raw) : undefined

      // The common case: an admin already ran the batch import (see
      // fetchLegacyImagesBatch in app/admin/obras/actions.ts), so the photo
      // is already sitting in our own storage under `legacy/<id>.jpg` —
      // just copy it into this user's own folder (cheap storage-to-storage
      // copy, no Drive involved) so it satisfies the same
      // "folder === user.id" check completeOnboarding applies to every
      // upload.
      if (legacy.image_url && legacy.image_path) {
        const destPath = `${user.id}/legacy-${legacy.id}.jpg`
        const { error: copyError } = await supabase.storage
          .from('artworks')
          .copy(legacy.image_path, destPath)
        if (!copyError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('artworks').getPublicUrl(destPath)
          legacyImagePreview = { path: destPath, publicUrl }
        }
      }

      // Fallback: the batch hasn't reached this row yet, or it previously
      // failed — fetch straight from Drive right now, just for this one
      // person. Safe to retry here even after a recorded batch failure
      // (Drive links can be flaky), since it's a single file, not a bulk
      // pass across dozens of them.
      if (!legacyImagePreview) {
        legacyImagePreview = await fetchAndStoreLegacyArtwork(supabase, user.id, {
          id: legacy.id,
          drive_url: legacy.drive_url,
        })
      }
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, name, country_code')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarded_at && !another) redirect('/')

  const suggestedName =
    (another ? profile?.name : null) ||
    legacyName ||
    (user.user_metadata?.full_name as string | undefined) ||
    ''

  // Same fallback order as suggestedName: a resubmission keeps whatever the
  // artist already has on file, otherwise fall back to the legacy import's
  // best-effort guess. No third fallback here — unlike name, there's
  // nothing in the Google auth profile to fall back to for country.
  const suggestedCountryCode = (another ? profile?.country_code : null) || legacyCountryCode || ''

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
          Anotá tu obra
        </p>
        <h1 className="font-display mt-3 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          Sumate al Mundial
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-muted-foreground">
          Contanos quién sos y subí tu collage — así aparece en el directorio de
          participantes y en la Primera Edición.
        </p>

        <OnboardingForm
          action={completeOnboarding}
          defaultName={suggestedName}
          defaultCountryCode={suggestedCountryCode}
          userId={user.id}
          error={error}
          hasLegacyMatch={Boolean(legacyName)}
          prefillImageUrl={legacyImagePreview?.publicUrl}
          prefillImagePath={legacyImagePreview?.path}
        />
      </div>
    </main>
  )
}
