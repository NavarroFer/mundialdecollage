'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidEmail } from '@/lib/resend'
import { storeLegacyArtworkGlobally } from '@/lib/legacy-submissions'
import { normalizeArtistName } from '@/lib/name-format'
import { guessCountryCodeFromName } from '@/lib/participants'
import { slugify } from '@/lib/slug'
import { ALLOWED_IMAGE_EXTENSIONS } from '@/lib/onboarding-image'
import { ADMIN_EMAILS } from '@/lib/admin'

// The service-role client bypasses RLS entirely, so any action that reaches
// for it (unlike the rest of this file, which relies on the session client +
// the "legacy_submissions: admin only" RLS policy as its real boundary) has
// to check admin-ness itself — a Server Action is a callable endpoint in its
// own right, reachable directly regardless of which page's admin gate
// rendered the button that normally triggers it.
async function assertIsAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    throw new Error('Not authorized')
  }
}

// A legacy_submissions row has no `profiles` row of its own (see
// submission-types.ts), so publishing one to the real public site means
// creating one on the fly: an auth user (so it has something profiles.id can
// reference), a profiles row, and a selected artworks row, built from
// whatever the legacy import captured (name, email, country_raw, the photo).
// Only ever called for rows that aren't already claimed_by someone — a
// self-registered or previously-provisioned row already has a real profile,
// nothing to create.
//
// Sequential, not Promise.all: each row is its own auth-admin round trip,
// and this runs inside a Server Action with a platform time limit. If a big
// batch (e.g. "Seleccionar las 156 visibles" → "Estas participan") gets cut
// off partway, that's fine to just resume — every row already written keeps
// claimed_by set, so re-running the same selection skips those instantly
// (the `alreadyClaimed` branch below) and continues with what's left.
async function provisionLegacyProfiles(
  items: { id: string; email: string; name: string | null; imageUrl: string; countryCode: string }[],
): Promise<{ profileIds: string[]; skipped: string[] }> {
  if (items.length === 0) return { profileIds: [], skipped: [] }

  // The one function in this flow that reaches for the service-role client —
  // same boundary as fetchLegacyImagesBatch/retryLegacyImageFetch above, and
  // for the same reason: it bypasses RLS entirely, so it has to gate itself
  // rather than lean on a policy. Both of this function's callers
  // (setSubmissionsVisibility, publishLegacySubmissionWithCountry) are
  // exported Server Actions reachable directly, not just from an
  // admin-gated page.
  await assertIsAdmin()

  const supabase = await createClient()
  const admin = createAdminClient()
  const profileIds: string[] = []
  const skipped: string[] = []

  // No admin.getUserByEmail() in this SDK — one paginated pass up front is
  // cheaper than a lookup per row, and this only runs for rows about to be
  // provisioned (typically a handful to a few dozen at a time).
  const emailToUserId = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data.users || data.users.length === 0) break
    for (const u of data.users) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id)
    }
    if (data.users.length < 1000) break
  }

  for (const item of items) {
    try {
      const emailKey = item.email.toLowerCase()
      let userId = emailToUserId.get(emailKey)

      if (!userId) {
        // email_confirm: true is what lets this same address later sign in
        // for real with Google and land on this same account instead of
        // colliding with it — Supabase only auto-links a new OAuth identity
        // onto an existing user when that user's email is already
        // confirmed.
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: item.email,
          email_confirm: true,
          user_metadata: item.name ? { full_name: item.name } : undefined,
        })
        if (createError || !created.user) {
          skipped.push(item.id)
          continue
        }
        userId = created.user.id
        emailToUserId.set(emailKey, userId)
      }

      // profiles has no "admin insert on behalf of someone else" policy
      // (only "users insert own"), so this has to go through the
      // service-role client — which makes protect_profile_visibility's
      // is_admin() check false and forces is_public back to false
      // regardless of what's passed here. The real flip to true happens
      // below, through the session client, same as the ordinary "Estas
      // participan" path a couple lines down.
      const { error: profileError } = await admin.from('profiles').upsert({
        id: userId,
        name: item.name,
        country_code: item.countryCode,
        onboarded_at: new Date().toISOString(),
      })
      if (profileError) {
        skipped.push(item.id)
        continue
      }

      const baseSlug = slugify(item.name ? `${item.name}-obra` : userId.slice(0, 8)) || userId.slice(0, 8)
      let slug = baseSlug
      for (let suffix = 2; ; suffix++) {
        const { data: taken } = await admin.from('artworks').select('id').eq('slug', slug).maybeSingle()
        if (!taken) break
        slug = `${baseSlug}-${suffix}`
      }

      const { error: artworkError } = await admin.from('artworks').insert({
        profile_id: userId,
        // The legacy import never captured a title — the artist can give it
        // a real one later by submitting again once (or if) they log in for
        // real, which an admin then curates via "Usar esta obra".
        title: item.name ? `Obra de ${item.name}` : 'Sin título',
        slug,
        image_url: item.imageUrl,
        is_selected: true,
      })
      if (artworkError) {
        skipped.push(item.id)
        continue
      }

      await supabase
        .from('legacy_submissions')
        .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
        .eq('id', item.id)

      profileIds.push(userId)
    } catch (err) {
      console.error('provisionLegacyProfiles: failed for', item.id, err)
      skipped.push(item.id)
    }
  }

  return { profileIds, skipped }
}

// The gallery's selection and the viewer both pass ids in the gallery's own
// mixed shape — a bare profiles.id for a real submission, or
// `legacy-<legacy_submissions.id>` for a precargada (see
// app/admin/obras/page.tsx's legacyGalleryItems) — so "Ocultar"/"Estas
// participan" work the same regardless of which kind is selected.
//
// Publishing (`isPublic: true`) a not-yet-claimed legacy id provisions a
// real account for it first (see provisionLegacyProfiles) — skipped when its
// country can't be guessed from the free-text import (no country to show on
// the public site); publishLegacySubmissionWithCountry below is the
// per-item fallback for those, with an explicit country picked by hand.
// Hiding (`isPublic: false`) a legacy id only matters if it's already
// claimed; an unclaimed one was never public to begin with, nothing to do.
export async function setSubmissionsVisibility(
  ids: string[],
  isPublic: boolean,
): Promise<{ skipped: string[] }> {
  if (ids.length === 0) return { skipped: [] }

  const realIds = ids.filter((id) => !id.startsWith('legacy-'))
  const legacyIds = ids.filter((id) => id.startsWith('legacy-')).map((id) => id.slice('legacy-'.length))

  const supabase = await createClient()
  const profileIdsToUpdate = [...realIds]
  let skipped: string[] = []

  if (legacyIds.length > 0) {
    const { data: rows } = await supabase
      .from('legacy_submissions')
      .select('id, email, name, country_raw, image_url, claimed_by')
      .in('id', legacyIds)

    for (const row of rows ?? []) {
      if (row.claimed_by) {
        profileIdsToUpdate.push(row.claimed_by)
        continue
      }
      if (!isPublic) continue // never published, nothing to hide

      const countryCode = row.country_raw ? guessCountryCodeFromName(row.country_raw) : undefined
      if (!row.image_url || !countryCode) {
        skipped.push(row.id)
        continue
      }

      const { profileIds, skipped: rowSkipped } = await provisionLegacyProfiles([
        { id: row.id, email: row.email, name: row.name, imageUrl: row.image_url, countryCode },
      ])
      profileIdsToUpdate.push(...profileIds)
      skipped = [...skipped, ...rowSkipped]
    }
  }

  if (profileIdsToUpdate.length > 0) {
    await supabase.from('profiles').update({ is_public: isPublic }).in('id', profileIdsToUpdate)
  }

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')

  return { skipped }
}

// Per-item fallback for a legacy submission whose country couldn't be
// guessed automatically (most of the imported "país" text didn't survive
// the original spreadsheet cleanup — see the "Obras precargadas" copy on
// the page) — an admin picks it by hand from the viewer instead.
export async function publishLegacySubmissionWithCountry(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase()
  if (!id || !countryCode) redirect('/admin/obras?error=missing_country')

  const supabase = await createClient()
  const { data: row, error: lookupError } = await supabase
    .from('legacy_submissions')
    .select('id, email, name, image_url, claimed_by')
    .eq('id', id)
    .maybeSingle()
  if (lookupError || !row) redirect(`/admin/obras?error=${encodeURIComponent(lookupError?.message ?? 'not_found')}`)

  let profileId = row.claimed_by
  if (!profileId) {
    if (!row.image_url) redirect('/admin/obras?error=missing_image')

    const { profileIds, skipped } = await provisionLegacyProfiles([
      { id: row.id, email: row.email, name: row.name, imageUrl: row.image_url, countryCode },
    ])
    if (skipped.length > 0 || profileIds.length === 0) redirect('/admin/obras?error=publish_failed')
    profileId = profileIds[0]
  }

  await supabase.from('profiles').update({ is_public: true }).eq('id', profileId)

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}

type ParsedLegacyLine = {
  email: string
  name: string | null
  driveUrl: string | null
  countryRaw: string | null
}

// Accepts "Nombre | email@dominio.com | link de Drive | país" — one per
// line, the same format the cleaned legacy dataset ships in (see
// legacy-submissions-import.txt). Only the email has to be valid; name,
// Drive link and país are all optional (país is expected to be blank for a
// lot of lines — most of the sheet's raw "País" text didn't survive the
// Deliverable 4 cleanup), same leniency as importContacts in
// app/admin/contactos/actions.ts.
function parseLegacyLine(line: string): ParsedLegacyLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const [namePart, emailPart, driveUrlPart, countryPart] = trimmed
    .split('|')
    .map((part) => part.trim())
  const email = emailPart ?? ''
  if (!isValidEmail(email)) return null

  return {
    email,
    name: namePart || null,
    driveUrl: driveUrlPart || null,
    countryRaw: countryPart || null,
  }
}

// Several artists sent in more than one artwork under the same email, so
// unlike importContacts this is NOT deduped by email — every distinct Drive
// link becomes its own row, and an admin later picks the one that counts via
// selectLegacySubmission. `drive_url` (not `email`) is the unique key, so
// re-pasting the same dataset twice stays idempotent.
export async function importLegacySubmissions(formData: FormData) {
  const raw = String(formData.get('legacy_entries') ?? '')

  const parsed = raw
    .split('\n')
    .map(parseLegacyLine)
    .filter((entry): entry is ParsedLegacyLine => entry !== null)

  if (parsed.length === 0) {
    redirect('/admin/obras?error=no_valid_legacy')
  }

  const supabase = await createClient()
  const { error: legacyError } = await supabase.from('legacy_submissions').upsert(
    parsed.map((p) => ({
      email: p.email.toLowerCase(),
      name: p.name,
      drive_url: p.driveUrl,
      country_raw: p.countryRaw,
    })),
    { onConflict: 'drive_url', ignoreDuplicates: true },
  )

  // Every artist whose obra gets imported should also be reachable from the
  // newsletter (/admin/contactos manages this same `contacts` table) — one
  // contact per unique email in this batch, not one per artwork, since
  // someone with several obras still only gets one mailing-list row.
  // ignoreDuplicates means someone already in `contacts` (e.g. added
  // manually before) is left untouched rather than overwritten.
  //
  // Best-effort: attempted regardless of whether the legacy_submissions
  // upsert above succeeded, since the parsed rows/emails are known either
  // way and the admin shouldn't lose the contacts side of the import just
  // because e.g. a duplicate drive_url tripped up the other table.
  const uniqueContacts = new Map<string, string | null>()
  for (const p of parsed) {
    const email = p.email.toLowerCase()
    if (!uniqueContacts.has(email)) uniqueContacts.set(email, p.name)
  }
  const { error: contactsError } = await supabase.from('contacts').upsert(
    [...uniqueContacts.entries()].map(([email, name]) => ({
      email,
      name,
      source: 'obra_email',
    })),
    { onConflict: 'email', ignoreDuplicates: true },
  )
  if (contactsError) {
    console.error('importLegacySubmissions: failed to upsert contacts', contactsError)
  }

  if (legacyError) {
    redirect(`/admin/obras?error=${encodeURIComponent(legacyError.message)}`)
  }

  revalidatePath('/admin/obras')
  revalidatePath('/admin/contactos')
  redirect(`/admin/obras?imported=${parsed.length}`)
}

// The admin's pick of which of an artist's (possibly several) submitted
// obras is "the" one that counts — /onboarding only ever prefills from a
// `selected = true` row. Two sequential updates instead of one clever query:
// this is low-volume admin-only traffic, not worth the complexity.
//
// `selected` alone used to also be what moved a row into the confirmed
// gallery; promoteLegacySubmission below is now the separate, deliberate
// second step for that (see supabase/migrations/20260921070000_legacy_
// submissions_promoted.sql). A lone obra has nothing to decide between, so
// it still promotes in this same click — the extra step only exists for
// picking among several. Switching which candidate is selected in a
// multi-obra group always resets promoted, so a previous promotion never
// silently carries over to whichever candidate happens to be selected now.
export async function selectLegacySubmission(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { data: row, error: lookupError } = await supabase
    .from('legacy_submissions')
    .select('email')
    .eq('id', id)
    .maybeSingle()
  if (lookupError || !row) {
    redirect(`/admin/obras?error=${encodeURIComponent(lookupError?.message ?? 'not_found')}`)
  }

  const { count: siblingCount, error: countError } = await supabase
    .from('legacy_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('email', row.email)
  if (countError) redirect(`/admin/obras?error=${encodeURIComponent(countError.message)}`)

  const { error: clearError } = await supabase
    .from('legacy_submissions')
    .update({ selected: false, promoted: false })
    .eq('email', row.email)
  if (clearError) redirect(`/admin/obras?error=${encodeURIComponent(clearError.message)}`)

  const { error: selectError } = await supabase
    .from('legacy_submissions')
    .update({ selected: true, promoted: siblingCount === 1 })
    .eq('id', id)
  if (selectError) redirect(`/admin/obras?error=${encodeURIComponent(selectError.message)}`)

  revalidatePath('/admin/obras')
}

// Pairs with components/admin/legacy-image-upload.tsx: an admin picks a
// file when the Drive fetch keeps failing (private file, deleted, or still
// failing after the fixes in lib/legacy-submissions.ts), uploads it
// straight to `legacy/<id>.<ext>` in the artworks bucket from their own
// session (the "artworks: admin upload/update" storage policies — see
// supabase/migrations/20260921080000_artworks_bucket_admin_write.sql — are
// the real boundary there, same as elsewhere in this file), and this just
// records the resulting path/URL. Re-checks the extension against the
// upload allowlist rather than trusting the client, same defensive pattern
// as completeOnboarding's re-check of its own upload path.
export async function setLegacyImageManually(formData: FormData) {
  const id = String(formData.get('id'))
  const path = String(formData.get('path'))

  const extension = path.split('.').pop()?.toLowerCase()
  if (path !== `legacy/${id}.${extension}` || !extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    redirect('/admin/obras?error=invalid_image')
  }

  const supabase = await createClient()
  const {
    data: { publicUrl },
  } = supabase.storage.from('artworks').getPublicUrl(path)

  const { error } = await supabase
    .from('legacy_submissions')
    .update({ image_path: path, image_url: publicUrl, image_fetch_failed_at: null })
    .eq('id', id)
  if (error) redirect(`/admin/obras?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/obras')
}

// The deliberate second step: moves an already-selected candidate into the
// confirmed gallery. Only meaningful for a multi-obra group — a lone obra
// promotes automatically inside selectLegacySubmission above and this
// button never renders for it.
export async function promoteLegacySubmission(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { error } = await supabase.from('legacy_submissions').update({ promoted: true }).eq('id', id)
  if (error) redirect(`/admin/obras?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/obras')
}

// How many Drive files to fetch per call — kept small so one invocation
// comfortably finishes inside a serverless function's time limit regardless
// of hosting plan. The client (see components/admin/legacy-image-sync.tsx)
// just calls this repeatedly until nothing's left.
const IMAGE_BATCH_SIZE = 5

// Copies one batch of legacy obra photos from Drive into our own storage —
// see storeLegacyArtworkGlobally for why this exists instead of only
// fetching lazily at registration time. Runs on the service-role client:
// this is triggered from an admin button, not tied to any artist's session,
// and rows aren't scoped to a user yet (nobody may ever register for some of
// them) — assertIsAdmin() is the real boundary here since the service-role
// client bypasses RLS entirely.
export async function fetchLegacyImagesBatch(): Promise<{
  attempted: number
  succeeded: number
  pending: number
  failed: number
  error: string | null
}> {
  await assertIsAdmin()
  const admin = createAdminClient()

  // Selected obras first: those are the only ones that can ever actually
  // show up on the site (the "read own unclaimed" RLS policy requires
  // selected = true), so working through a big backlog gets the obras that
  // matter into durable storage before the discarded candidates from
  // multi-submission artists.
  const { data: rows, error: selectError } = await admin
    .from('legacy_submissions')
    .select('id, drive_url')
    .is('image_url', null)
    .is('image_fetch_failed_at', null)
    .not('drive_url', 'is', null)
    .order('selected', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(IMAGE_BATCH_SIZE)

  if (selectError) {
    console.error('fetchLegacyImagesBatch: failed to list pending rows', selectError)
    return { attempted: 0, succeeded: 0, pending: 0, failed: 0, error: selectError.message }
  }

  const batch = rows ?? []
  // Each row is an independent Drive fetch + sharp resize — safe to run
  // concurrently within a batch, and cuts a full sync's wall-clock time
  // roughly by IMAGE_BATCH_SIZE instead of processing one row at a time.
  const results = await Promise.all(
    batch.map(async (row) => {
      const result = await storeLegacyArtworkGlobally(admin, { id: row.id, drive_url: row.drive_url })
      if (result) {
        const { error: updateError } = await admin
          .from('legacy_submissions')
          .update({ image_path: result.path, image_url: result.publicUrl, image_fetch_failed_at: null })
          .eq('id', row.id)
        if (updateError) {
          console.error('fetchLegacyImagesBatch: failed to save fetched image', row.id, updateError)
          return false
        }
        return true
      }

      const { error: failError } = await admin
        .from('legacy_submissions')
        .update({ image_fetch_failed_at: new Date().toISOString() })
        .eq('id', row.id)
      if (failError) {
        console.error('fetchLegacyImagesBatch: failed to mark row as failed', row.id, failError)
      }
      return false
    }),
  )
  const succeeded = results.filter(Boolean).length

  const [{ count: pending, error: pendingError }, { count: failed, error: failedError }] =
    await Promise.all([
      admin
        .from('legacy_submissions')
        .select('id', { count: 'exact', head: true })
        .is('image_url', null)
        .is('image_fetch_failed_at', null)
        .not('drive_url', 'is', null),
      admin
        .from('legacy_submissions')
        .select('id', { count: 'exact', head: true })
        .not('image_fetch_failed_at', 'is', null),
    ])
  if (pendingError) console.error('fetchLegacyImagesBatch: failed to count pending', pendingError)
  if (failedError) console.error('fetchLegacyImagesBatch: failed to count failed', failedError)

  revalidatePath('/admin/obras')
  return {
    attempted: batch.length,
    succeeded,
    pending: pending ?? 0,
    failed: failed ?? 0,
    error: pendingError?.message ?? failedError?.message ?? null,
  }
}

// One-row version of fetchLegacyImagesBatch — lets an admin retry a specific
// failed fetch right there (e.g. after re-sharing a Drive file that was
// private) without waiting for a full batch or deleting/re-importing the
// row. Same trust boundary as the batch version: service-role client, so
// assertIsAdmin() up front is what actually gates it.
export async function retryLegacyImageFetch(formData: FormData) {
  await assertIsAdmin()
  const id = String(formData.get('id'))

  const admin = createAdminClient()
  const { data: row, error: lookupError } = await admin
    .from('legacy_submissions')
    .select('id, drive_url')
    .eq('id', id)
    .maybeSingle()
  if (lookupError || !row) {
    redirect(`/admin/obras?error=${encodeURIComponent(lookupError?.message ?? 'not_found')}`)
  }

  const result = await storeLegacyArtworkGlobally(admin, { id: row.id, drive_url: row.drive_url })
  if (result) {
    const { error: updateError } = await admin
      .from('legacy_submissions')
      .update({ image_path: result.path, image_url: result.publicUrl, image_fetch_failed_at: null })
      .eq('id', row.id)
    if (updateError) redirect(`/admin/obras?error=${encodeURIComponent(updateError.message)}`)
  } else {
    const { error: failError } = await admin
      .from('legacy_submissions')
      .update({ image_fetch_failed_at: new Date().toISOString() })
      .eq('id', row.id)
    if (failError) redirect(`/admin/obras?error=${encodeURIComponent(failError.message)}`)
    redirect('/admin/obras?error=retry_failed')
  }

  revalidatePath('/admin/obras')
}

export async function deleteLegacySubmission(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { error } = await supabase.from('legacy_submissions').delete().eq('id', id)
  if (error) redirect(`/admin/obras?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/obras')
}

// The registered-artist equivalent of selectLegacySubmission: which of a
// profile's (possibly several) submitted artworks is the one that counts.
// Unlike legacy_submissions, artworks has no owner-update RLS policy at all
// (see supabase/migrations/20260921040000_artworks.sql) — curation is
// admin-only by construction, so this relies on "artworks: admin only" the
// same way selectLegacySubmission relies on "legacy_submissions: admin
// only". Picking/dropping an artist's selected artwork changes what's live
// on the public site immediately (unlike legacy curation, which only ever
// affects a future /onboarding prefill), so this revalidates the public
// pages too, matching setSubmissionsVisibility above.
export async function selectArtwork(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { data: row, error: lookupError } = await supabase
    .from('artworks')
    .select('profile_id')
    .eq('id', id)
    .maybeSingle()
  if (lookupError || !row) {
    redirect(`/admin/obras?error=${encodeURIComponent(lookupError?.message ?? 'not_found')}`)
  }

  const { error: clearError } = await supabase
    .from('artworks')
    .update({ is_selected: false })
    .eq('profile_id', row.profile_id)
  if (clearError) redirect(`/admin/obras?error=${encodeURIComponent(clearError.message)}`)

  const { error: selectError } = await supabase.from('artworks').update({ is_selected: true }).eq('id', id)
  if (selectError) redirect(`/admin/obras?error=${encodeURIComponent(selectError.message)}`)

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}

export async function deleteArtwork(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { error } = await supabase.from('artworks').delete().eq('id', id)
  if (error) redirect(`/admin/obras?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}

// Bulk version of deleteArtwork/deleteLegacySubmission for the gallery's
// selection bar — same {table, id} shape as applyNameCleanup, for the same
// reason: the two tables a selection can span need two different deletes.
export async function deleteSubmissions(items: { table: 'artworks' | 'legacy_submissions'; id: string }[]) {
  if (items.length === 0) return

  const supabase = await createClient()
  const artworkIds = items.filter((item) => item.table === 'artworks').map((item) => item.id)
  const legacyIds = items.filter((item) => item.table === 'legacy_submissions').map((item) => item.id)

  await Promise.all([
    artworkIds.length > 0 ? supabase.from('artworks').delete().in('id', artworkIds) : null,
    legacyIds.length > 0 ? supabase.from('legacy_submissions').delete().in('id', legacyIds) : null,
  ])

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}

// Applies the "limpieza de nombres" cleanup an admin approved in
// components/admin/name-cleanup.tsx (see the "Limpieza de nombres" section
// of /admin/obras). Only ever takes {table, id} pairs from the client, never
// the proposed new name itself — the normalized value is recomputed here
// from whatever is actually in the row right now, so a stale preview (e.g.
// someone else edited the name in between) can't overwrite it with the
// wrong text, and re-running this on an already-clean name is a harmless
// no-op either way.
export async function applyNameCleanup(items: { table: 'profiles' | 'legacy_submissions'; id: string }[]) {
  if (items.length === 0) return

  const supabase = await createClient()
  const profileIds = items.filter((item) => item.table === 'profiles').map((item) => item.id)
  const legacyIds = items.filter((item) => item.table === 'legacy_submissions').map((item) => item.id)

  await Promise.all([
    (async () => {
      if (profileIds.length === 0) return
      const { data: rows } = await supabase.from('profiles').select('id, name').in('id', profileIds)
      await Promise.all(
        (rows ?? []).map((row) => {
          if (!row.name) return null
          const normalized = normalizeArtistName(row.name)
          if (normalized === row.name) return null
          return supabase.from('profiles').update({ name: normalized }).eq('id', row.id)
        }),
      )
    })(),
    (async () => {
      if (legacyIds.length === 0) return
      const { data: rows } = await supabase.from('legacy_submissions').select('id, name').in('id', legacyIds)
      await Promise.all(
        (rows ?? []).map((row) => {
          if (!row.name) return null
          const normalized = normalizeArtistName(row.name)
          if (normalized === row.name) return null
          return supabase.from('legacy_submissions').update({ name: normalized }).eq('id', row.id)
        }),
      )
    })(),
  ])

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}
