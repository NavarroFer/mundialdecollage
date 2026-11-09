'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isCallOpen } from '@/lib/call-state'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { slugify } from '@/lib/slug'
import { uniqueArtworkSlug } from '@/lib/artwork-slug'
import { getAllCountryCodes, TECHNIQUES } from '@/lib/participants'
import { ALLOWED_IMAGE_EXTENSIONS } from '@/lib/onboarding-image'
import { trackServer, trackSignupSource } from '@/lib/track-server'
import { recordReferral } from '@/lib/referral-server'
import { site } from '@/lib/site'
import { refreshPublicData } from '@/lib/public-data-cache'
import { recordTermsAcceptance } from '@/lib/terms-acceptance'
import { normalizeInstagram, normalizeWebsite } from '@/lib/profile-links'
import { cleanInstagramInput, cleanWebsiteInput } from '@/lib/onboarding-input'

// The checkbox in TermsCheckbox. Checked again here: the form's `required`
// is only a convenience.
function acceptedTerms(formData: FormData) {
  return formData.get('accept_terms') === 'on'
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
  if (!acceptedTerms(formData)) redirect(errorUrl('terms_required'))
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

  // Once the call is closed (/admin/convocatoria) only a first submission
  // that claims an obra sent by mail before the close goes through.
  if (!(await isCallOpen())) {
    const { data: legacy } = isFirstSubmission && user.email
      ? await supabase.from('legacy_submissions').select('id').eq('email', user.email.toLowerCase()).eq('selected', true).is('claimed_by', null).is('archived_at', null).limit(1)
      : { data: [] }
    if (!legacy?.length) redirect('/onboarding')
  }

  // Artists can keep several obras and choose which take part, but not
  // upload without limit (site.entries.maxStored).
  const { count: existingCount } = await supabase
    .from('artworks')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .eq('is_club_only', false)
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
  if (!(await recordTermsAcceptance(supabase, user.id))) redirect(errorUrl('save_failed'))

  // One at a time: each slug is checked against the rows already inserted,
  // so two obras with the same title in one submission still get distinct
  // slugs.
  for (const [index, artworkTitle] of titles.entries()) {
    // slugify() strips anything outside [a-z0-9] — a name/title with no Latin
    // characters at all (a real possibility in an *international* contest)
    // collapses to '', which /obras/[slug] can't route to. Fall back to a
    // slice of the user id so every submission still gets a working page.
    const baseSlug = slugify(`${name}-${artworkTitle}`) || user.id.slice(0, 8)
    const slug = await uniqueArtworkSlug(supabase, baseSlug)

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

  if (isFirstSubmission) {
    await trackServer('signup_done', user.id)
    // Arrived through an artist's shared link: that artist gets the credit
    // (lib/referral-server.ts — never throws, a failure is only logged).
    const referred = await recordReferral(user.id)
    if (referred) await trackServer('referral_signup', user.id)
    await trackSignupSource(user.id, referred)
  }
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

  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  const artworkId = String(formData.get('artwork_id') ?? '')
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  if (!name || !getAllCountryCodes().includes(countryCode)) {
    return 'missing'
  }
  if (!title) return 'missing_title'
  if (!acceptedTerms(formData)) return 'terms_required'

  // Links and técnica are corrected here too. A form that doesn't send them
  // leaves what is stored untouched.
  const profileChanges: Record<string, unknown> = { name, country_code: countryCode }
  if (formData.has('instagram')) {
    const input = cleanInstagramInput(String(formData.get('instagram')))
    const instagram = input ? normalizeInstagram(input) : null
    if (input === null || (input && !instagram)) return 'invalid_instagram'
    profileChanges.instagram = instagram
  }
  if (formData.has('website')) {
    const input = cleanWebsiteInput(String(formData.get('website')))
    const website = input ? normalizeWebsite(input) : null
    if (input === null || (input && !website)) return 'invalid_website'
    profileChanges.website = website
  }
  const techniqueInput = formData.has('technique') ? String(formData.get('technique')).trim() : undefined
  if (techniqueInput && !(TECHNIQUES as readonly string[]).includes(techniqueInput)) return 'save_failed'

  const { data: artwork, error: artworkError } = await supabase.from('artworks')
    .select('id, slug, title, technique').eq('id', artworkId).eq('profile_id', user.id).maybeSingle()
  if (artworkError || !artwork) return 'not_found'
  if (!(await recordTermsAcceptance(supabase, user.id))) return 'save_failed'

  // artworks has no UPDATE grant for artists; the select above already
  // proved this obra is theirs. A title written here is never replaced by
  // the Registro sync (it only follows titles that still match the sheet).
  const artworkChanges: Record<string, unknown> = {}
  if (title !== artwork.title) artworkChanges.title = title
  if (techniqueInput !== undefined && (techniqueInput || null) !== (artwork.technique ?? null)) artworkChanges.technique = techniqueInput || null
  const admin = createAdminClient()
  if (Object.keys(artworkChanges).length > 0) {
    const { error: artworkUpdateError } = await admin.from('artworks')
      .update(artworkChanges).eq('id', artwork.id).eq('profile_id', user.id)
    if (artworkUpdateError) return 'save_failed'
  }

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .update({ ...profileChanges, details_confirmed_at: new Date().toISOString() })
    .eq('id', user.id).select('id').maybeSingle()
  if (profileError || !profile) return 'save_failed'

  // The mailing list's copy of the name is the one newsletters greet with
  // (the misspelled one that arrived with the Registro): fix it too.
  // Best-effort, and a person who never subscribed has no row.
  if (user.email) {
    const { error: contactError } = await admin.from('contacts').update({ name }).eq('email', user.email.trim().toLowerCase())
    if (contactError) console.error('confirmArtistDetails: contact name update failed', user.id, contactError)
  }

  refreshPublicData()
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath(`/obras/${artwork.slug}`)
  await trackServer('signup_done', user.id)
  await trackSignupSource(user.id, false)
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

  refreshPublicData()
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  redirect('/')
}
