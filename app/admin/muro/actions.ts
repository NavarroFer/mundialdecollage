'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WALL_BUCKET } from '@/lib/collage-wall'

// Moderation of the collective collage (app/galeria-3d/wall-actions.ts).
// Runs on the admin's own session: wall_pieces' RLS and the 'wall' bucket's
// delete policy only let admins in.
async function setStatus(formData: FormData, status: 'approved' | 'rejected') {
  const id = String(formData.get('id') ?? '')
  const tab = String(formData.get('tab') ?? 'pendientes')
  const next = String(formData.get('next') ?? '')
  if (!id) return

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('wall_pieces')
    .update({ status, moderated_at: new Date().toISOString() })
    .eq('id', id)
    .select('image_path')
    .single()
  if (error) redirect(`/admin/muro?tab=${tab}&error=${encodeURIComponent(error.message)}`)

  // A rejected photo leaves the collage for good, so its file goes too (the
  // row stays, in case the same person keeps posting). Its life comes back.
  if (status === 'rejected' && data?.image_path) {
    const { error: removeError } = await supabase.storage.from(WALL_BUCKET).remove([data.image_path])
    if (removeError) redirect(`/admin/muro?tab=${tab}&error=${encodeURIComponent(`Rechazada, pero no se pudo borrar la foto: ${removeError.message}`)}`)
  }

  if (next) redirect(`/admin/muro?tab=${tab}#piece-${encodeURIComponent(next)}`)
  revalidatePath('/admin/muro')
}

export async function approvePiece(formData: FormData) {
  await setStatus(formData, 'approved')
}

export async function rejectPiece(formData: FormData) {
  await setStatus(formData, 'rejected')
}
