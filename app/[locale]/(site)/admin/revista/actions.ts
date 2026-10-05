'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Marks a paid magazine order as shipped (or undoes it). Runs on the admin's
// own session: magazine_orders' RLS only lets admins in.
export async function setMagazineShipped(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const shipped = formData.get('shipped') === '1'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('magazine_orders')
    .update({ shipped_at: shipped ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('status', 'paid')
  if (error) redirect(`/admin/revista?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/revista')
}
