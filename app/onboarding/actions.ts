'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { slugify } from '@/lib/slug'
import { getAllCountryCodes } from '@/lib/participants'
import { ALLOWED_IMAGE_EXTENSIONS } from '@/lib/onboarding-image'
import { trackServer } from '@/lib/track-server'
import { site } from '@/lib/site'

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
  const instagramInput = String(formData.get('instagram') ?? '').trim()
  const websiteInput = String(formData.get('website') ?? '').trim()
  // One entry per obra, in the order the form lists them: an artist can send
  // several at once and then choose which takes part (lib/entries.ts). The
  // images themselves are uploaded client-side straight to Supabase Storage
  // (see onboarding-form.tsx) — Vercel's Server Action body limit (~4.5MB)
  // sits well under the photos people actually submit. This action only
  // gets the resulting storage paths back.
  const titles = formData.getAll('artwork_title').map((value) => String(value).trim())
  const techniques = formData.getAll('technique').map((value) => String(value).trim())
  const imagePaths = formData.getAll('artwork_image_path').map((value) => String(value).trim())
  // Errors send a resubmission back to the same "another obra" form.
  const errorUrl = (code: string) =>
    formData.get('another') ? `/onboarding?another=1&error=${code}` : `/onboarding?error=${code}`

  if (!name || !countryCode || titles.length === 0 || titles.some((title) => !title)) {
    redirect(errorUrl('missing_fields'))
  }
  if (imagePaths.length !== titles.length || imagePaths.some((path) => !path)) {
    redirect(errorUrl('missing_image'))
  }

  const instagram = instagramInput ? normalizeInstagram(instagramInput) : null
  if (instagramInput && !instagram) {
    redirect(errorUrl('invalid_instagram'))
  }
  const website = websiteInput ? normalizeWebsite(websiteInput) : null
  if (websiteInput && !website) {
    redirect(errorUrl('invalid_website'))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // A profile with onboarded_at already set has submitted before — this is
  // a resubmission (see the "Enviar otra obra" link on ParticipationStatus).
  // New obras land as unselected artworks rows and the artist chooses on
  // /onboarding/obras which obra takes part (one for free, more after
  // paying — lib/entries.ts). A first-ever submission's first obra
  // auto-selects, so even an artist who never chooses takes part.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle()
  const isFirstSubmission = !existingProfile?.onboarded_at

  // Artists can keep several obras and choose which take part, but not
  // upload without limit (site.entries.maxStored).
  const { count: existingCount } = await supabase
    .from('artworks')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .is('archived_at', null)
    .is('duplicate_of', null)
  const totalArtworks = (existingCount ?? 0) + titles.length
  if (totalArtworks > site.entries.maxStored) redirect(errorUrl('too_many_artworks'))

  // The upload RLS policy already confines writes to `${uid}/...`, but the
  // paths arrive here as plain form data — re-check none was tampered with
  // before we treat it as this user's own file.
  const publicUrls: string[] = []
  for (const imagePath of imagePaths) {
    const [folder, filename] = imagePath.split('/')
    const extension = filename?.split('.').pop()?.toLowerCase()
    if (folder !== user.id || !filename || !extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      redirect(errorUrl('invalid_image'))
    }

    const { data: existingFiles } = await supabase.storage.from('artworks').list(folder, {
      search: filename,
    })
    if (!existingFiles?.some((file) => file.name === filename)) {
      redirect(errorUrl('upload_failed'))
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('artworks').getPublicUrl(imagePath)
    publicUrls.push(publicUrl)
  }

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
    redirect(errorUrl('save_failed'))
  }

  // One at a time: each slug is checked against the rows already inserted,
  // so two obras with the same title in one submission still get distinct
  // slugs.
  for (const [index, artworkTitle] of titles.entries()) {
    // slugify() strips anything outside [a-z0-9] — a name/title with no Latin
    // characters at all (a real possibility in an *international* contest)
    // collapses to '', which /obras/[slug] can't route to. Fall back to a
    // slice of the user id so every submission still gets a working page.
    const baseSlug = slugify(`${name}-${artworkTitle}`) || user.id.slice(0, 8)
    const slug = await uniqueSlug(supabase, baseSlug)

    const { error: artworkError } = await supabase.from('artworks').insert({
      profile_id: user.id,
      title: artworkTitle,
      slug,
      image_url: publicUrls[index],
      technique: techniques[index] || null,
      is_selected: isFirstSubmission && index === 0,
    })
    if (artworkError) {
      console.error('onboarding: failed to save artwork', user.id, artworkError)
      redirect(errorUrl('save_failed'))
    }
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

  if (isFirstSubmission) await trackServer('signup_done', user.id)
  // With more than one obra on the account, the artist chooses which takes
  // part before anything else.
  if (!isFirstSubmission) redirect('/onboarding/obras?nueva=1')
  if (totalArtworks > 1) redirect('/onboarding/obras')
  redirect('/onboarding/confirmado')
}

// Confirmation edits only the signed-in artist's profile. The artwork stays
// intact: publication and curation remain under the existing admin policies.
// Returns an error code ('' on success, which redirects instead) that
// ArtistConfirmation shows in the reader's language (confirmation.errors).
export async function confirmArtistDetails(_previous: string, formData: FormData): Promise<string> {
  if (!isSupabaseConfigured) return 'unavailable'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'session'

  const name = String(formData.get('name') ?? '').trim()
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  const artworkId = String(formData.get('artwork_id') ?? '')
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  if (!name || !getAllCountryCodes().includes(countryCode)) {
    return 'missing'
  }
  if (!title) return 'missing_title'
  const { data: artwork, error: artworkError } = await supabase.from('artworks')
    .select('id, slug, title').eq('id', artworkId).eq('profile_id', user.id).maybeSingle()
  if (artworkError || !artwork) return 'not_found'

  // artworks has no UPDATE grant for artists; the select above already
  // proved this obra is theirs. A title written here is never replaced by
  // the Registro sync (it only follows titles that still match the sheet).
  if (title !== artwork.title) {
    const { error: titleError } = await createAdminClient().from('artworks')
      .update({ title }).eq('id', artwork.id).eq('profile_id', user.id)
    if (titleError) return 'save_failed'
  }

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .update({ name, country_code: countryCode, details_confirmed_at: new Date().toISOString() })
    .eq('id', user.id).select('id').maybeSingle()
  if (profileError || !profile) return 'save_failed'

  revalidatePath('/')
  revalidatePath('/participantes')
  revalidatePath('/edicion-2026')
  revalidatePath(`/obras/${artwork.slug}`)
  await trackServer('signup_done', user.id)
  redirect('/onboarding/confirmado')
}

// For a profile that /admin/obras published without a país (the free-text
// legacy import couldn't guess one — see provisionLegacyProfiles in
// app/admin/obras/actions.ts) — ParticipationStatus asks for it here the
// next time this person actually logs in, alongside técnica since the
// legacy import never captured that either. A lighter completion step than
// the full onboarding form: the artwork already exists, this only fills in
// the two gaps on it.
export async function completeMissingDetails(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/')

  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  const technique = String(formData.get('technique') ?? '').trim()
  if (!countryCode) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ country_code: countryCode })
    .eq('id', user.id)
  if (profileError) {
    console.error('completeMissingDetails: failed to update profile', user.id, profileError)
    redirect('/')
  }

  // Optional, same as on the full onboarding form — only written if given.
  if (technique) {
    await supabase
      .from('artworks')
      .update({ technique })
      .eq('profile_id', user.id)
      .eq('is_selected', true)
  }

  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
  redirect('/')
}
