'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { slugify } from '@/lib/slug'
import { ALLOWED_IMAGE_EXTENSIONS } from '@/lib/onboarding-image'

// Stored as a full URL (rendered straight into an <a href> on /obras/[slug]),
// so this also doubles as XSS defense — only ever accept http(s), never
// javascript: or other schemes.
function normalizeWebsite(value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

// The form asks for a handle ("@tu.usuario"), not a URL, but it's rendered
// the same way as website — build the real profile URL here so both the
// link target and the XSS defense live in one place.
function normalizeInstagram(value: string): string | null {
  if (!value) return null
  const handle = value
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null
}

// Finds a free artwork slug. Every artwork row (including a 2nd+ submission
// from a returning artist) needs its own distinct slug now that a
// resubmission is a new `artworks` row instead of overwriting the old one in
// place — so unlike the old single-artwork version of this function, there's
// no "exclude my own existing row" case to special-case.
//
// Checks via the artwork_slug_taken RPC rather than a plain SELECT: RLS only
// lets a submitter see their own rows or already-published ones, so a slug
// belonging to someone else's unpublished/uncurated artwork would otherwise
// look free here and then fail the insert below with a real
// unique-constraint violation.
async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string) {
  let slug = base
  for (let suffix = 2; ; suffix++) {
    const { data: taken } = await supabase.rpc('artwork_slug_taken', { candidate: slug })
    if (!taken) return slug
    slug = `${base}-${suffix}`
  }
}

export async function completeOnboarding(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/')

  const name = String(formData.get('name') ?? '').trim()
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  const technique = String(formData.get('technique') ?? '').trim()
  const artworkTitle = String(formData.get('artwork_title') ?? '').trim()
  const instagramInput = String(formData.get('instagram') ?? '').trim()
  const websiteInput = String(formData.get('website') ?? '').trim()
  // The image itself is uploaded client-side straight to Supabase Storage
  // (see onboarding-form.tsx) — Vercel's Server Action body limit (~4.5MB)
  // sits well under the photos people actually submit. This action only
  // gets the resulting storage path back.
  const imagePath = String(formData.get('artwork_image_path') ?? '').trim()

  if (!name || !countryCode || !artworkTitle) {
    redirect('/onboarding?error=missing_fields')
  }
  if (!imagePath) {
    redirect('/onboarding?error=missing_image')
  }

  const instagram = instagramInput ? normalizeInstagram(instagramInput) : null
  if (instagramInput && !instagram) {
    redirect('/onboarding?error=invalid_instagram')
  }
  const website = websiteInput ? normalizeWebsite(websiteInput) : null
  if (websiteInput && !website) {
    redirect('/onboarding?error=invalid_website')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // A profile with onboarded_at already set has submitted before — this is
  // a resubmission (see the "Enviar otra obra" link on ParticipationStatus).
  // Its artwork lands as a new artworks row that an admin has to curate via
  // "Usar esta obra" (app/admin/obras/actions.ts's selectArtwork) before it
  // replaces the currently-selected one; a first-ever submission has
  // nothing to curate against, so it auto-selects.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle()
  const isFirstSubmission = !existingProfile?.onboarded_at

  // The upload RLS policy already confines writes to `${uid}/...`, but the
  // path arrives here as plain form data — re-check it wasn't tampered with
  // before we treat it as this user's own file.
  const [folder, filename] = imagePath.split('/')
  const extension = filename?.split('.').pop()?.toLowerCase()
  if (folder !== user.id || !filename || !extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    redirect('/onboarding?error=invalid_image')
  }

  const { data: existingFiles } = await supabase.storage.from('artworks').list(folder, {
    search: filename,
  })
  if (!existingFiles?.some((file) => file.name === filename)) {
    redirect('/onboarding?error=upload_failed')
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('artworks').getPublicUrl(imagePath)

  // slugify() strips anything outside [a-z0-9] — a name/title with no Latin
  // characters at all (a real possibility in an *international* contest)
  // collapses to '', which /obras/[slug] can't route to. Fall back to a
  // slice of the user id so every submission still gets a working page.
  const baseSlug = slugify(`${name}-${artworkTitle}`) || user.id.slice(0, 8)
  const slug = await uniqueSlug(supabase, baseSlug)

  // profiles row first — artworks.profile_id references it, and for a
  // first-time submitter this row doesn't exist yet. onboarded_at is only
  // ever set once: omitting it here on a resubmission leaves the original
  // value untouched (upsert only writes the keys present in the payload).
  const profilePayload: Record<string, unknown> = {
    id: user.id,
    name,
    country_code: countryCode,
    instagram,
    website,
  }
  if (isFirstSubmission) profilePayload.onboarded_at = new Date().toISOString()

  const { error: profileError } = await supabase.from('profiles').upsert(profilePayload)
  if (profileError) {
    console.error('onboarding: failed to save profile', user.id, profileError)
    redirect('/onboarding?error=save_failed')
  }

  const { error: artworkError } = await supabase.from('artworks').insert({
    profile_id: user.id,
    title: artworkTitle,
    slug,
    image_url: publicUrl,
    technique: technique || null,
    is_selected: isFirstSubmission,
  })
  if (artworkError) {
    console.error('onboarding: failed to save artwork', user.id, artworkError)
    redirect('/onboarding?error=save_failed')
  }

  // Best-effort: mark the matching legacy_submissions row (if any) as
  // claimed, so it stops being offered for prefill and can't be matched
  // twice. Runs on the user's own session client — the "legacy_submissions:
  // claim own unclaimed" RLS policy (supabase/migrations/20260919000000_
  // legacy_submissions.sql) is the real boundary here, no service client
  // needed. A failure here never blocks the redirect below: the profile
  // upsert above is what actually matters, this table is just bookkeeping.
  if (user.email) {
    const { error: claimError } = await supabase
      .from('legacy_submissions')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('email', user.email.toLowerCase())
      .eq('selected', true)
      .is('claimed_by', null)
    if (claimError) {
      console.error('onboarding: failed to claim legacy submission', user.id, claimError)
    }
  }

  redirect('/')
}
