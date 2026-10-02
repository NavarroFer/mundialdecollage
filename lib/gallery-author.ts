import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// The name gallery comments and collective-collage pieces are signed with:
// what the artist wrote in their profile, else their Google name, else the
// part of the email before the @.
export async function authorName(user: User): Promise<string> {
  const { data: profile } = await createAdminClient().from('profiles').select('name').eq('id', user.id).maybeSingle()
  const metadata = user.user_metadata ?? {}
  const candidates = [profile?.name, metadata.full_name, metadata.name, user.email?.split('@')[0]]
  const name = candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
  return (name ?? 'Visitante').trim().slice(0, 80)
}
