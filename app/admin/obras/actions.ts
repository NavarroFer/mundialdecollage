'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidEmail } from '@/lib/resend'

// Called directly from the gallery's bulk-action bar (not a <form> submit) —
// the "profiles: admin update all" RLS policy is the real boundary here, so
// this stays on the session client rather than reaching for the service-role
// one.
export async function setSubmissionsVisibility(ids: string[], isPublic: boolean) {
  if (ids.length === 0) return

  const supabase = await createClient()
  await supabase.from('profiles').update({ is_public: isPublic }).in('id', ids)

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
    .update({ selected: false })
    .eq('email', row.email)
  if (clearError) redirect(`/admin/obras?error=${encodeURIComponent(clearError.message)}`)

  const { error: selectError } = await supabase
    .from('legacy_submissions')
    .update({ selected: true })
    .eq('id', id)
  if (selectError) redirect(`/admin/obras?error=${encodeURIComponent(selectError.message)}`)

  revalidatePath('/admin/obras')
}

export async function deleteLegacySubmission(formData: FormData) {
  const id = String(formData.get('id'))

  const supabase = await createClient()
  const { error } = await supabase.from('legacy_submissions').delete().eq('id', id)
  if (error) redirect(`/admin/obras?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/obras')
}
