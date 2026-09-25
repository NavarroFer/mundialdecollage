'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Moderation of the 3D gallery's comments (app/galeria-3d/actions.ts). Runs
// on the admin's own session: artwork_comments' RLS only lets admins in.
async function setStatus(formData: FormData, status: 'approved' | 'rejected') {
  const id = String(formData.get('id') ?? '')
  const tab = String(formData.get('tab') ?? 'pendientes')
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('artwork_comments')
    .update({ status, moderated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) redirect(`/admin/comentarios?tab=${tab}&error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/comentarios')
}

export async function approveComment(formData: FormData) {
  await setStatus(formData, 'approved')
}

// Rejected rather than deleted: it disappears for everyone (the author only
// ever sees their own *pending* ones) but stays on record in case the same
// person keeps posting.
export async function rejectComment(formData: FormData) {
  await setStatus(formData, 'rejected')
}
