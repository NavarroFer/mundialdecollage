'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPaidEntries } from '@/lib/entry-payments'
import { isValidEmail } from '@/lib/resend'
import { storeLegacyArtworkGlobally } from '@/lib/legacy-submissions'
import { reuseRegistroArtwork } from '@/lib/reuse-registro-artwork'
import { normalizeArtistName } from '@/lib/name-format'
import { guessCountryCodeFromName } from '@/lib/participants'
import { provisionLegacyProfiles, publishPendingLegacySubmissions } from '@/lib/publish-legacy'
import { ALLOWED_IMAGE_EXTENSIONS } from '@/lib/onboarding-image'
import { ADMIN_EMAILS } from '@/lib/admin'
import { refreshPublicData } from '@/lib/public-data-cache'

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

// Every confirmed Registro obra goes public as soon as it has its photo —
// there's no manual publish step anymore. Called after each admin action
// that can complete that condition. Best-effort: a failure here leaves the
// row for the next run (or the next Registro cron) instead of failing the
// action that just succeeded.
async function publishReadyLegacySubmissions() {
  await assertIsAdmin()
  try {
    const { profileIds, skipped } = await publishPendingLegacySubmissions(createAdminClient())
    if (skipped.length > 0) console.error('publishReadyLegacySubmissions: skipped', skipped)
    if (profileIds.length > 0) revalidatePublicPages()
  } catch (err) {
    console.error('publishReadyLegacySubmissions failed', err)
  }
}

function revalidatePublicPages() {
  refreshPublicData()
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}

// The gallery's selection and the viewer both pass ids in the gallery's own
// mixed shape — a bare profiles.id for a real submission, or
// `legacy-<legacy_submissions.id>` for a precargada (see
// app/admin/obras/page.tsx's legacyGalleryItems) — so "Ocultar"/"Estas
// participan" work the same regardless of which kind is selected.
//
// Publishing (`isPublic: true`) a not-yet-claimed legacy id provisions a
// real account for it first (see provisionLegacyProfiles). A country that
// can't be guessed from the free-text import no longer blocks this — it
// just goes in as null (Fer: "no importa si no está el país, que quede sin
// valor, y cuando entren se lo pedimos junto con la técnica"); the only
// remaining skip reason is a row with no image at all, which shouldn't
// happen for anything reaching here through the gallery (it only lists
// `promoted` rows that already have one — see legacyGalleryItems in
// app/admin/obras/page.tsx), just defensive for a direct call.
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

      if (!row.image_url) {
        skipped.push(row.id)
        continue
      }
      const countryCode = row.country_raw ? guessCountryCodeFromName(row.country_raw) : undefined

      await assertIsAdmin()
      const { profileIds, skipped: rowSkipped } = await provisionLegacyProfiles(createAdminClient(), [
        { id: row.id, email: row.email, name: row.name, countryCode },
      ])
      profileIdsToUpdate.push(...profileIds)
      skipped = [...skipped, ...rowSkipped]
    }
  }

  if (profileIdsToUpdate.length > 0) {
    await supabase.from('profiles').update({ is_public: isPublic }).in('id', profileIdsToUpdate)
  }

  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')

  return { skipped }
}

const REVIEW_STATUSES = new Set(['unreviewed', 'preselected', 'rejected'])

// Editorial review is deliberately separate from public visibility and from
// `is_selected` (an artist's representative artwork). The gallery sends its
// mixed identifiers, so update the matching source table for each row.
export async function setSubmissionsReviewStatus(
  ids: string[],
  reviewStatus: 'unreviewed' | 'preselected' | 'rejected',
) {
  if (ids.length === 0 || !REVIEW_STATUSES.has(reviewStatus)) return
  await assertIsAdmin()

  const artworkIds = ids.filter((id) => !id.startsWith('legacy-'))
  const legacyIds = ids.filter((id) => id.startsWith('legacy-')).map((id) => id.slice('legacy-'.length))
  const admin = createAdminClient()

  const results = await Promise.all([
    artworkIds.length > 0 ? admin.from('artworks').update({ review_status: reviewStatus }).in('id', artworkIds) : null,
    legacyIds.length > 0 ? admin.from('legacy_submissions').update({ review_status: reviewStatus }).in('id', legacyIds) : null,
  ])
  const error = results.find((result) => result?.error)?.error
  if (error) throw new Error(error.message)

  revalidatePath('/admin/obras')
}

const TECHNIQUE_VALUES = new Set(['Analógica', 'Mixta', 'Digital'])

// Bulk «Técnica» from the obras gallery: the three fixed categories, or null
// to clear it. A sheet row (legacy-…) also passes it to the artwork already
// linked from it, since the grid shows that artwork through its sheet row;
// rows linked later inherit it (inherit_legacy_technique).
export async function setSubmissionsTechnique(ids: string[], technique: string | null) {
  if (ids.length === 0 || (technique !== null && !TECHNIQUE_VALUES.has(technique))) return
  await assertIsAdmin()

  const artworkIds = ids.filter((id) => !id.startsWith('legacy-'))
  const legacyIds = ids.filter((id) => id.startsWith('legacy-')).map((id) => id.slice('legacy-'.length))
  const admin = createAdminClient()

  const results = await Promise.all([
    artworkIds.length > 0 ? admin.from('artworks').update({ technique }).in('id', artworkIds) : null,
    legacyIds.length > 0 ? admin.from('legacy_submissions').update({ technique }).in('id', legacyIds) : null,
    legacyIds.length > 0 ? admin.from('artworks').update({ technique }).in('legacy_submission_id', legacyIds) : null,
  ])
  const error = results.find((result) => result?.error)?.error
  if (error) throw new Error(error.message)

  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/participantes')
  revalidatePath('/')
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
// obras is "the" one that counts. Every artist already gets one confirmed
// automatically (supabase/migrations/20260923120000_auto_promote_legacy_
// submissions.sql); this is the manual correction from the viewer, so the
// new pick is confirmed in the same click. Two sequential updates instead of
// one clever query: this is low-volume admin-only traffic.
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

  const { error: clearError } = await supabase
    .from('legacy_submissions')
    .update({ selected: false, promoted: false })
    .eq('email', row.email)
  if (clearError) redirect(`/admin/obras?error=${encodeURIComponent(clearError.message)}`)

  const { error: selectError } = await supabase
    .from('legacy_submissions')
    .update({ selected: true, promoted: true })
    .eq('id', id)
  if (selectError) redirect(`/admin/obras?error=${encodeURIComponent(selectError.message)}`)

  await publishReadyLegacySubmissions()
  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/galeria-3d')
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
  const stamp = path.startsWith(`legacy/${id}-`) ? path.slice(`legacy/${id}-`.length, -(`.${extension}`.length)) : ''
  const validPath = path === `legacy/${id}.${extension}` || (/^\d+$/.test(stamp) && path.endsWith(`.${extension}`))
  if (!extension || !ALLOWED_IMAGE_EXTENSIONS.has(extension) || !validPath) {
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

  await publishReadyLegacySubmissions()
  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/galeria-3d')
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
    .select('id, drive_url, claimed_by')
    .is('archived_at', null)
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
        try {
          await reuseRegistroArtwork(admin, row, result.fingerprint)
        } catch (matchError) {
          console.error('fetchLegacyImagesBatch: image needs duplicate review', row.id, matchError)
          await admin.from('legacy_submissions').update({ image_fetch_failed_at: new Date().toISOString() }).eq('id', row.id)
          return false
        }
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
        .is('archived_at', null)
        .is('image_url', null)
        .is('image_fetch_failed_at', null)
        .not('drive_url', 'is', null),
      admin
        .from('legacy_submissions')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .not('image_fetch_failed_at', 'is', null),
    ])
  if (pendingError) console.error('fetchLegacyImagesBatch: failed to count pending', pendingError)
  if (failedError) console.error('fetchLegacyImagesBatch: failed to count failed', failedError)

  if (succeeded > 0) await publishReadyLegacySubmissions()
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
    .select('id, drive_url, claimed_by')
    .eq('id', id)
    .maybeSingle()
  if (lookupError || !row) {
    redirect(`/admin/obras?error=${encodeURIComponent(lookupError?.message ?? 'not_found')}`)
  }

  const result = await storeLegacyArtworkGlobally(admin, { id: row.id, drive_url: row.drive_url })
  if (result) {
    try {
      await reuseRegistroArtwork(admin, row, result.fingerprint)
    } catch (matchError) {
      redirect(`/admin/obras?error=${encodeURIComponent(String(matchError))}`)
    }
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

  await publishReadyLegacySubmissions()
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

  // The chosen obra is now the postulated one (a trigger marks it entered).
  // An artist who didn't pay for more entries keeps only that one.
  if (!(await hasPaidEntries(supabase, row.profile_id))) {
    const { error: enteredError } = await supabase
      .from('artworks')
      .update({ is_entered: false })
      .eq('profile_id', row.profile_id)
      .neq('id', id)
    if (enteredError) redirect(`/admin/obras?error=${encodeURIComponent(enteredError.message)}`)
  }

  refreshPublicData()
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

  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}

const ARTWORK_TECHNIQUES = new Set(['Analógica', 'Mixta', 'Digital'])

// Fixes an already-loaded (and possibly already-public) artwork in place:
// title, technique and/or its photo. A replacement photo is uploaded from the
// admin's browser first (see components/admin/artwork-edit-form.tsx) into a
// fresh `admin/<artworkId>/<timestamp>.<ext>` path — never overwriting the
// old file, so the new image gets a new URL instead of the CDN/next/image
// cache serving the old one for hours. Runs on the service-role client
// (artworks has no UPDATE grant for `authenticated`, see
// 20260921040000_artworks.sql), so assertIsAdmin() is the real boundary.
// Updating image_url here is safe against the Registro sync: it links rows
// by legacy_submission_id and never rewrites an existing artwork's image.
export async function updateArtwork(input: {
  artworkId: string
  title: string
  technique: string
  imagePath?: string
}): Promise<{ error?: string }> {
  await assertIsAdmin()

  // Empty is allowed: the site shows "Sin datos" and asks the artist for it.
  const title = input.title.trim() || null
  if (input.technique && !ARTWORK_TECHNIQUES.has(input.technique)) return { error: 'Técnica inválida.' }

  const admin = createAdminClient()
  const update: { title: string | null; technique: string | null; image_url?: string } = {
    title,
    technique: input.technique || null,
  }

  if (input.imagePath) {
    const extension = input.imagePath.split('.').pop()?.toLowerCase() ?? ''
    const prefix = `admin/${input.artworkId}/`
    if (
      !input.imagePath.startsWith(prefix) ||
      !/^\d+$/.test(input.imagePath.slice(prefix.length, -(extension.length + 1))) ||
      !ALLOWED_IMAGE_EXTENSIONS.has(extension)
    ) {
      return { error: 'Imagen inválida.' }
    }
    update.image_url = admin.storage.from('artworks').getPublicUrl(input.imagePath).data.publicUrl
  }

  const { data: row, error } = await admin
    .from('artworks')
    .update(update)
    .eq('id', input.artworkId)
    .select('slug')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!row) return { error: 'No se encontró la obra.' }

  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
  revalidatePath('/galeria-3d')
  revalidatePath(`/obras/${row.slug}`)
  return {}
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

  refreshPublicData()
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

  refreshPublicData()
  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}
