import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Approving or rejecting what visitors send from the 3D gallery works the
// same for every queue (comments in /admin/comentarios, collective collage
// photos in /admin/muro): the admin's form posts the row's id, the tab it
// came from and the next row to scroll to; the row gets its status and
// moderated_at. Runs on the admin's own session, so each table's RLS is what
// lets only admins in. A queue only says where it lives and what else to do.

export type ModerationStatus = 'approved' | 'rejected'

export type ModerationQueue = {
  table: string
  /** Its admin page, e.g. /admin/comentarios. */
  path: string
  /** Each row's anchor on that page: #<anchor>-<id>. */
  anchor: string
  /** Columns `afterModeration` needs from the updated row. */
  columns?: string
  /** Extra work once the status is saved; a returned message shows as the page's error. */
  afterModeration?: (context: {
    supabase: SupabaseClient
    row: Record<string, unknown>
    status: ModerationStatus
  }) => Promise<string | null>
}

export type ModerationForm = { id: string; tab: string; next: string }

export function readModerationForm(formData: FormData): ModerationForm {
  return {
    id: String(formData.get('id') ?? ''),
    tab: String(formData.get('tab') ?? 'pendientes'),
    next: String(formData.get('next') ?? ''),
  }
}

/** Back to the queue's tab: with an error, or scrolled to the next row. */
export function moderationUrl(
  queue: Pick<ModerationQueue, 'path' | 'anchor'>,
  { tab, next, error }: { tab: string; next?: string; error?: string },
): string {
  const query = new URLSearchParams({ tab, ...(error ? { error } : {}) })
  return `${queue.path}?${query}${next ? `#${queue.anchor}-${encodeURIComponent(next)}` : ''}`
}

export async function moderate(queue: ModerationQueue, formData: FormData, status: ModerationStatus): Promise<void> {
  const { id, tab, next } = readModerationForm(formData)
  if (!id) return

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(queue.table)
    .update({ status, moderated_at: new Date().toISOString() })
    .eq('id', id)
    .select(queue.columns ?? 'id')
    .single<Record<string, unknown>>()
  if (error) redirect(moderationUrl(queue, { tab, error: error.message }))

  const problem = await queue.afterModeration?.({ supabase, row: data ?? {}, status })
  if (problem) redirect(moderationUrl(queue, { tab, error: problem }))

  if (next) redirect(moderationUrl(queue, { tab, next }))
  revalidatePath(queue.path)
}
