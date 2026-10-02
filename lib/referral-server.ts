// Server side of the artists' invitations (lib/referral.ts): who a shared
// link greets, and crediting the artist when their guest signs up. Like
// lib/track-server.ts, nothing here throws — an invitation must never break
// the page it's on, let alone a submission.
import { cookies } from 'next/headers'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ADMIN_EMAILS } from '@/lib/admin'
import { parseReferral, REFERRAL_COOKIE } from '@/lib/referral'

type Referrer = { profileId: string; name: string }

// The service role, not the reader's session: an obra still under review is
// shared too (its artist links the home instead, see share-artwork.tsx), and
// only its artist could read it otherwise. Only the name ever leaves here.
async function resolveReferrer(slug: string): Promise<Referrer | null> {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const { data, error } = await createAdminClient()
    .from('artworks')
    .select('profile_id, profiles!inner(name)')
    .eq('slug', slug)
    .is('archived_at', null)
    .maybeSingle()
  if (error) console.error('referral: failed to resolve', slug, error.message)
  // Many-to-one embed typed as an array without generated types — see
  // lib/finalists.ts.
  const row = data as unknown as { profile_id: string; profiles: { name: string | null } | null } | null
  const name = row?.profiles?.name?.trim()
  return row && name ? { profileId: row.profile_id, name } : null
}

async function cookieReferral(): Promise<string | null> {
  return parseReferral((await cookies()).get(REFERRAL_COOKIE)?.value)
}

/**
 * The artist to name in the invitation (components/referral-invite.tsx): the
 * one in this link's ?ref, else the one whose link first brought this
 * visitor. Nobody who already takes part — or runs the site — is invited;
 * `hideForSignedIn` also skips people signed in without an obra, for pages
 * that already ask them to finish (ParticipationStatus on the home).
 */
export async function getReferralInvite(
  urlRef: unknown,
  { hideForSignedIn = false }: { hideForSignedIn?: boolean } = {},
): Promise<{ name: string } | null> {
  try {
    const slug = parseReferral(urlRef) ?? (await cookieReferral())
    if (!slug || !isSupabaseConfigured) return null

    const user = await getCurrentUser()
    if (user) {
      const supabase = await createClient()
      if (hideForSignedIn || ADMIN_EMAILS.includes(user.email ?? '')) return null
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarded_at')
        .eq('id', user.id)
        .maybeSingle()
      if (error || profile?.onboarded_at) return null
    }

    const referrer = await resolveReferrer(slug)
    return referrer && referrer.profileId !== user?.id ? { name: referrer.name } : null
  } catch (error) {
    console.error('referral: invite failed', error)
    return null
  }
}

/**
 * Credits the artist whose link brought `userId` (the mdc-ref cookie) with
 * their first submission. Returns whether a referral was recorded. One per
 * artist: a second call keeps the first credit.
 */
export async function recordReferral(userId: string): Promise<boolean> {
  try {
    const slug = await cookieReferral()
    if (!slug) return false
    const referrer = await resolveReferrer(slug)
    // Opening your own link and then signing up isn't inviting anyone.
    if (!referrer || referrer.profileId === userId) return false

    const { error } = await createAdminClient()
      .from('referrals')
      .upsert(
        { referred_id: userId, referrer_id: referrer.profileId, artwork_slug: slug },
        { onConflict: 'referred_id', ignoreDuplicates: true },
      )
    if (error) {
      console.error('referral: failed to record', userId, error.message)
      return false
    }
    return true
  } catch (error) {
    console.error('referral: failed to record', userId, error)
    return false
  }
}

/** How many artists signed up through this artist's links. 0 on any error. */
export async function countReferrals(referrerId: string): Promise<number> {
  try {
    const supabase = await createClient()
    // RLS ("referrals: referrer read own") limits this to the artist's own rows.
    const { count, error } = await supabase
      .from('referrals')
      .select('referred_id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}
