import type { SupabaseClient } from '@supabase/supabase-js'
import { clubGallerySlug, DEFAULT_HOST_AVATAR } from '@/lib/club-subscriptions'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The database refuses more than this in one gift (grant_club_courtesy_gallery). */
export const MAX_COURTESY_COINS = 100_000

export type CourtesyInput = {
  email: string
  /** The gallery's name; empty uses the artist's profile name. Only a new gallery takes it. */
  title: string
  coins: number
  /** Drawn fresh with the form, so a double click gifts the coins once. */
  reference: string
}

export type CourtesyResult =
  | { ok: true; outcome: 'created' | 'reactivated' | 'already_courtesy'; slug: string }
  | { ok: false; error: 'invalid' | 'no_account' | 'no_name' | 'paying' | 'unavailable' }

/**
 * Gives an artist their Club gallery as a courtesy, active at once and with
 * no subscription, and gifts them coins. Runs with the admin's own session:
 * the database functions check is_admin() and do the work in one transaction
 * (supabase/migrations/20261029180000_club_courtesy_galleries.sql). The
 * artist needs an account, that is, to have signed in to the site once.
 */
export async function grantCourtesyGallery(db: SupabaseClient, input: CourtesyInput): Promise<CourtesyResult> {
  const email = input.email.trim().toLowerCase()
  const { coins } = input
  if (!EMAIL.test(email) || email.length > 254 || !UUID.test(input.reference)
    || !Number.isInteger(coins) || coins < 0 || coins > MAX_COURTESY_COINS) {
    return { ok: false, error: 'invalid' }
  }

  const { data: accounts, error: lookupError } = await db.rpc('admin_club_account', { p_email: email })
  if (lookupError) return { ok: false, error: 'unavailable' }
  const account = (accounts as { user_id: string; name: string | null }[] | null)?.[0]
  if (!account) return { ok: false, error: 'no_account' }
  // Never the email: the title is public on the gallery.
  const title = (input.title.trim() || account.name?.trim() || '').slice(0, 120)
  if (!title) return { ok: false, error: 'no_name' }

  const { data, error } = await db.rpc('grant_club_courtesy_gallery', {
    p_user_id: account.user_id,
    p_slug: clubGallerySlug(title, account.user_id),
    p_title: title,
    p_host_avatar_id: DEFAULT_HOST_AVATAR,
    p_coins: coins,
    p_reference: input.reference,
  })
  const row = (data as { outcome: string; gallery_slug: string }[] | null)?.[0]
  if (error || !row) return { ok: false, error: 'unavailable' }
  if (row.outcome === 'paying') return { ok: false, error: 'paying' }
  if (row.outcome !== 'created' && row.outcome !== 'reactivated' && row.outcome !== 'already_courtesy') {
    return { ok: false, error: 'unavailable' }
  }
  return { ok: true, outcome: row.outcome, slug: row.gallery_slug }
}
