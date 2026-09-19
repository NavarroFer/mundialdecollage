import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { fetchAndStoreLegacyArtwork } from '@/lib/legacy-submissions'
import { OnboardingForm } from './onboarding-form'
import { completeOnboarding } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
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

  // Before the real registration flow existed, ~90 artists already sent in
  // their collage by email — see supabase/migrations/20260919000000_legacy_
  // submissions.sql. Some sent more than one; an admin curates those down to
  // one `selected` row from /admin/obras, and only that curated row is ever
  // offered here. No match (including "not curated yet") is just the normal
  // blank-form path, not an error.
  let legacyName: string | null = null
  let legacyImagePreview: { path: string; publicUrl: string } | null = null
  const email = user.email?.toLowerCase()
  if (email) {
    const { data: legacy } = await supabase
      .from('legacy_submissions')
      .select('id, name, drive_url')
      .eq('email', email)
      .is('claimed_by', null)
      .eq('selected', true)
      .maybeSingle()

    if (legacy) {
      legacyName = legacy.name
      // Fetched lazily, right now, for this one person — not in bulk during
      // admin import, which would risk a serverless timeout across dozens of
      // files and waste storage on people who never actually register.
      legacyImagePreview = await fetchAndStoreLegacyArtwork(supabase, user.id, {
        id: legacy.id,
        drive_url: legacy.drive_url,
      })
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarded_at) redirect('/')

  const { error } = await searchParams
  const suggestedName = legacyName || (user.user_metadata?.full_name as string | undefined) || ''

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
