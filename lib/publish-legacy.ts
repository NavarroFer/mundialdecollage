import type { SupabaseClient } from '@supabase/supabase-js'
import { guessCountryCodeFromName } from '@/lib/participants'

export type LegacyPublishItem = {
  id: string
  email: string
  name: string | null
  countryCode?: string
}

// A legacy_submissions row has no `profiles` row of its own, so publishing
// one to the public site means creating an auth user (so profiles.id has
// something to reference) and letting link_registro_user build the profile
// and artwork from the imported row. profiles.is_public defaults to true
// (20260921100000_publish_everything_by_default.sql), so this alone makes
// the obra public.
//
// Needs the service-role client: callers are the Registro cron/script and
// admin Server Actions that check admin-ness themselves.
//
// Sequential, not Promise.all: each row is its own auth-admin round trip.
// A run cut off partway is safe to repeat — provisioned rows already have
// claimed_by set and drop out of publishPendingLegacySubmissions' query.
export async function provisionLegacyProfiles(
  admin: SupabaseClient,
  items: LegacyPublishItem[],
): Promise<{ profileIds: string[]; skipped: string[] }> {
  if (items.length === 0) return { profileIds: [], skipped: [] }

  const profileIds: string[] = []
  const skipped: string[] = []

  // No admin.getUserByEmail() in this SDK — one paginated pass up front is
  // cheaper than a lookup per row.
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
        // onto an existing user when that user's email is already confirmed.
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: item.email,
          email_confirm: true,
          user_metadata: item.name ? { full_name: item.name } : undefined,
        })
        if (createError || !created.user) {
          console.error('provisionLegacyProfiles: create user failed', item.id, createError)
          skipped.push(item.id)
          continue
        }
        userId = created.user.id
        emailToUserId.set(emailKey, userId)
      }

      // Creating a verified auth user already fires auth_link_registro.
      // Reuse that same locked, idempotent linker for existing users and
      // retries instead of inserting a second, untracked artwork here.
      const { error: linkError } = await admin.rpc('link_registro_user', { target_user: userId })
      if (linkError) {
        console.error('provisionLegacyProfiles: link failed', item.id, linkError)
        skipped.push(item.id)
        continue
      }
      const { data: linked, error: lookupError } = await admin.from('artworks')
        .select('id')
        .eq('legacy_submission_id', item.id)
        .eq('profile_id', userId)
        .is('archived_at', null)
        .maybeSingle()
      if (lookupError || !linked) {
        skipped.push(item.id)
        continue
      }

      // Preserve the country inferred from free text when an older imported
      // row has no normalized country_code for the linker to use.
      if (item.countryCode) {
        const { error: countryError } = await admin.from('profiles')
          .update({ country_code: item.countryCode })
          .eq('id', userId)
          .is('country_code', null)
        if (countryError) {
          skipped.push(item.id)
          continue
        }
      }
      profileIds.push(userId)
    } catch (err) {
      console.error('provisionLegacyProfiles: failed for', item.id, err)
      skipped.push(item.id)
    }
  }

  return { profileIds, skipped }
}

// Publishes every confirmed (promoted) Registro obra that already has its
// photo but no account yet. Rows without a photo wait: they show up in
// "Obras precargadas sin foto" on /admin/obras and publish on the run after
// the photo lands.
export async function publishPendingLegacySubmissions(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('legacy_submissions')
    .select('id, email, name, country_raw')
    .is('archived_at', null)
    .is('claimed_by', null)
    .eq('promoted', true)
    .not('image_url', 'is', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`No se pudieron listar las obras a publicar: ${error.message}`)

  return provisionLegacyProfiles(
    admin,
    (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      countryCode: row.country_raw ? guessCountryCodeFromName(row.country_raw) : undefined,
    })),
  )
}
