import type { SupabaseClient } from '@supabase/supabase-js'

// Finds a free artwork slug. Every artwork row (including a 2nd+ submission
// from a returning artist, or an obra uploaded only for the Club) needs its
// own distinct slug.
//
// Checks via the artwork_slug_taken RPC rather than a plain SELECT: RLS only
// lets a submitter see their own rows or already-published ones, so a slug
// belonging to someone else's unpublished/uncurated artwork would otherwise
// look free here and then fail the insert with a real unique-constraint
// violation.
export async function uniqueArtworkSlug(supabase: SupabaseClient, base: string) {
  let slug = base
  for (let suffix = 2; ; suffix++) {
    const { data: taken } = await supabase.rpc('artwork_slug_taken', { candidate: slug })
    if (!taken) return slug
    slug = `${base}-${suffix}`
  }
}
