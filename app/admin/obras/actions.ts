'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Called directly from the gallery's bulk-action bar (not a <form> submit) —
// the "profiles: admin update all" RLS policy is the real boundary here, so
// this stays on the session client rather than reaching for the service-role
// one.
export async function setSubmissionsVisibility(ids: string[], isPublic: boolean) {
  if (ids.length === 0) return

  const supabase = await createClient()
  await supabase.from('profiles').update({ is_public: isPublic }).in('id', ids)

  revalidatePath('/admin/obras')
  revalidatePath('/')
  revalidatePath('/edicion-2026')
  revalidatePath('/participantes')
}
