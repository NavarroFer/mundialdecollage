import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Total count of collage works received for the Mundial, shown in the
// "Primera Edición" banner — real count of completed submissions, never
// hardcoded (ver ROADMAP.md, sección "Primera Edición"). This is every obra
// received, published or not — see get_total_submissions_count() in
// supabase/migrations/20260921090000_total_submissions_count.sql for why a
// plain `profiles`/`legacy_submissions` count from this anon client can't
// compute that itself.
export async function getSubmissionsCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0

  const { data } = await createPublicClient().rpc('get_total_submissions_count')

  return data ?? 0
}
