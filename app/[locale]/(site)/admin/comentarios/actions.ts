'use server'

import { moderate, type ModerationQueue } from '@/lib/moderation'

// Moderation of the 3D gallery's comments (app/galeria-3d/actions.ts).
const comments: ModerationQueue = { table: 'artwork_comments', path: '/admin/comentarios', anchor: 'comment' }

export async function approveComment(formData: FormData) {
  await moderate(comments, formData, 'approved')
}

// Rejected rather than deleted: it disappears for everyone (the author only
// ever sees their own *pending* ones) but stays on record in case the same
// person keeps posting.
export async function rejectComment(formData: FormData) {
  await moderate(comments, formData, 'rejected')
}
