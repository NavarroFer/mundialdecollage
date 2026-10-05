'use server'

import { moderate, type ModerationQueue } from '@/lib/moderation'
import { WALL_BUCKET } from '@/lib/collage-wall'

// Moderation of the collective collage (app/galeria-3d/wall-actions.ts).
const wall: ModerationQueue = {
  table: 'wall_pieces',
  path: '/admin/muro',
  anchor: 'piece',
  columns: 'image_path',
  // A rejected photo leaves the collage for good, so its file goes too (the
  // row stays, in case the same person keeps posting). Its life comes back.
  // The 'wall' bucket's delete policy only lets admins in.
  async afterModeration({ supabase, row, status }) {
    const imagePath = typeof row.image_path === 'string' ? row.image_path : null
    if (status !== 'rejected' || !imagePath) return null
    const { error } = await supabase.storage.from(WALL_BUCKET).remove([imagePath])
    return error ? `Rechazada, pero no se pudo borrar la foto: ${error.message}` : null
  },
}

export async function approvePiece(formData: FormData) {
  await moderate(wall, formData, 'approved')
}

export async function rejectPiece(formData: FormData) {
  await moderate(wall, formData, 'rejected')
}
