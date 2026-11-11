import { createAdminClient } from '@/lib/supabase/admin'

// One row, flipped from /admin/comunidad. Read on each post, never cached in
// the build, so the switch applies without a deploy. A missing row or a
// failed read means moderation stays manual.

export async function readAiModerationEnabled(): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('community_settings')
      .select('ai_moderation')
      .eq('id', true)
      .maybeSingle()
    if (error || !data) return false
    return (data as { ai_moderation: boolean }).ai_moderation === true
  } catch {
    return false
  }
}
