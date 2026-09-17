import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Total count of collage works received for the Mundial, shown in the
// "Primera Edición" banner — real count of completed submissions, never
// hardcoded (ver ROADMAP.md, sección "Primera Edición").
export async function getSubmissionsCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0

  const { count } = await createPublicClient()
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('onboarded_at', 'is', null)

  return count ?? 0
}
