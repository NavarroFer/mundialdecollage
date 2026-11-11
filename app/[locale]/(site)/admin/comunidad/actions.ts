'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ADMIN_EMAILS } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// The email is the permission. The service role bypasses RLS, so the check
// has to live here. The row itself stays admin-only for any other client.

export async function setCommunityModeration(formData: FormData) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) redirect('/admin/comunidad?error=sin+permiso')
  const enabled = formData.getAll('enabled').includes('on')
  const { error } = await createAdminClient().from('community_settings').update({
    ai_moderation: enabled,
    updated_at: new Date().toISOString(),
  }).eq('id', true)
  if (error) redirect(`/admin/comunidad?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/comunidad')
  redirect('/admin/comunidad?ok=1')
}
