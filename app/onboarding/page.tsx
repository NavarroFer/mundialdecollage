import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { fetchAndStoreLegacyArtwork } from '@/lib/legacy-submissions'
import { guessCountryCodeFromName } from '@/lib/participants'
import { needsEntryChoice } from '@/lib/entries'
import { site } from '@/lib/site'
import { OnboardingForm } from './onboarding-form'
import { completeOnboarding } from './actions'
import { ArtistConfirmation } from './artist-confirmation'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import type { Messages } from '@/lib/i18n/messages'

function LoadingProblem({ m }: { m: Messages }) {
  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="max-w-lg rounded-2xl bg-card p-8 text-center">
        <h1 className="font-display text-3xl">{m.onboarding.loadingProblemTitle}</h1>
        <p className="my-4 text-muted-foreground">{m.onboarding.loadingProblemBody}</p>
        <Link href="/onboarding" className="inline-flex min-h-11 items-center font-semibold text-collage-blue underline">{m.onboarding.retry}</Link>
      </div>
    </main>
  )
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; another?: string }>
}) {
  if (!isSupabaseConfigured) redirect('/')

  const { m } = await getI18n()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return (
      <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg rounded-2xl bg-card p-8 text-center">
          <h1 className="font-display text-3xl uppercase">{m.onboarding.signInTitle}</h1>
          <p className="my-6 text-muted-foreground">{m.onboarding.signInBody}</p>
          <GoogleSignInButton next="/onboarding" />
        </div>
      </main>
    )
  }

  // Admins log in to moderate, not to submit an artwork — skip the
  // onboarding form and drop them straight into the panel.
  if (ADMIN_EMAILS.includes(user.email ?? '')) redirect('/admin')

  const { error, another } = await searchParams

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded_at, name, country_code, instagram, website, entries_chosen_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return <LoadingProblem m={m} />

  // Every obra on this account: one takes part for free, and an artist with
  // several (more than one sent by mail, or uploaded another) chooses which
  // on /onboarding/obras before anything else. See lib/entries.ts.
  const { data: artworks, error: artworksError } = await supabase
    .from('artworks')
    .select('id, title, image_url')
    .eq('profile_id', user.id)
    .is('archived_at', null)
    .is('duplicate_of', null)
    .order('is_selected', { ascending: false })
    .order('created_at', { ascending: false })

  if (artworksError) return <LoadingProblem m={m} />
  const artworkCount = artworks?.length ?? 0

  if (another && artworkCount >= site.entries.maxStored) redirect('/onboarding/obras')

  // Provisioned artists already own an artwork. Review that row instead of
  // creating a second submission just because this is their first Google login.
  if (!another) {
    if (needsEntryChoice(artworkCount, profile?.entries_chosen_at)) redirect('/onboarding/obras')

    const artwork = artworks?.[0]
    if (artwork) {
      const name = profile?.name || user.user_metadata?.full_name || ''
      return (
        <main className="bg-grain min-h-screen px-5 py-12 sm:py-16">
          <div className="mx-auto w-full max-w-lg">
            <p className="text-center text-sm font-bold tracking-widest text-collage-blue uppercase">{m.onboarding.welcomeEyebrow}</p>
            <h1 className="font-display mt-3 text-center text-3xl text-ink sm:text-4xl">{name ? fmt(m.onboarding.helloName, { name }) : m.onboarding.welcome}</h1>
            <p className="mt-4 text-center text-muted-foreground">{m.onboarding.existingBody}</p>
            <ArtistConfirmation name={name} countryCode={profile?.country_code || ''} email={user.email || ''} artwork={artwork} artworkCount={artworkCount} />
          </div>
        </main>
      )
    }
  }

  // Before the real registration flow existed, ~90 artists already sent in
  // their collage by email — see supabase/migrations/20260919000000_legacy_
  // submissions.sql. Some sent more than one; an admin curates those down to
  // one `selected` row from /admin/obras, and only that curated row is ever
  // offered here. No match (including "not curated yet") is just the normal
  // blank-form path, not an error. Skipped entirely for a resubmission
  // (?another=1, linked from ParticipationStatus's "Enviar otra obra") —
  // that prefill only ever makes sense for someone's very first submission.
  let hasLegacyMatch = false
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
    const { data: legacy, error: legacyError } = await supabase
      .from('legacy_submissions')
      .select('id, name, country_raw, drive_url, image_path, image_url')
      .eq('email', email)
      .is('archived_at', null)
      .is('claimed_by', null)
      .eq('selected', true)
      .maybeSingle()

    if (legacyError) return <LoadingProblem m={m} />

    if (legacy) {
      hasLegacyMatch = true
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
        const { data: files } = await supabase.storage.from('artworks').list(user.id, { search: `legacy-${legacy.id}.jpg` })
        const alreadyCopied = files?.some(file => file.name === `legacy-${legacy.id}.jpg`)
        const { error: copyError } = alreadyCopied ? { error: null } : await supabase.storage
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

  const suggestedName =
    profile?.name ||
    legacyName ||
    (user.user_metadata?.full_name as string | undefined) ||
    ''

  // Prefer the artist’s saved profile, then fall back to the legacy import’s
  // best-effort guess. No third fallback here — unlike name, there's
  // nothing in the Google auth profile to fall back to for country.
  const suggestedCountryCode = profile?.country_code || legacyCountryCode || ''

  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg">
        <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">
          {hasLegacyMatch ? m.onboarding.welcomeEyebrow : m.onboarding.formEyebrow}
        </p>
        <h1 className="font-display mt-3 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          {hasLegacyMatch
            ? suggestedName
              ? fmt(m.onboarding.helloName, { name: suggestedName })
              : m.onboarding.hello
            : m.onboarding.formTitle}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-muted-foreground">
          {hasLegacyMatch ? m.onboarding.legacyBody : m.onboarding.formBody}
        </p>

        <OnboardingForm
          action={completeOnboarding}
          defaultName={suggestedName}
          defaultCountryCode={suggestedCountryCode}
          defaultInstagram={profile?.instagram ?? ''}
          defaultWebsite={profile?.website ?? ''}
          userId={user.id}
          error={error}
          hasLegacyMatch={hasLegacyMatch}
          email={user.email || ''}
          prefillImageUrl={legacyImagePreview?.publicUrl}
          prefillImagePath={legacyImagePreview?.path}
          entriesNote
          maxArtworks={site.entries.maxStored - artworkCount}
          another={Boolean(another)}
        />
      </div>
    </main>
  )
}
