import type { SupabaseClient } from '@supabase/supabase-js'
import { TERMS_VERSION } from '@/lib/terms-version'

// terms_acceptances: one row per person and version, the record of their
// consent. Shared by the onboarding's server actions and the prompt for
// signed-in people who haven't accepted (components/terms-prompt.tsx):
// either client acts as the person, so RLS only lets them write their own
// row, and the database stamps accepted_at.

/** Accepting the same version again is a no-op. */
export async function recordTermsAcceptance(supabase: SupabaseClient, profileId: string) {
  const { error } = await supabase
    .from('terms_acceptances')
    .upsert({ profile_id: profileId, terms_version: TERMS_VERSION }, { onConflict: 'profile_id,terms_version', ignoreDuplicates: true })
  if (error) console.error('terms: failed to record acceptance', profileId, error)
  return !error
}

/** Whether the person accepted the current version. Throws when it can't tell. */
export async function hasAcceptedCurrentTerms(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('terms_acceptances')
    .select('id')
    .eq('profile_id', profileId)
    .eq('terms_version', TERMS_VERSION)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data !== null
}
