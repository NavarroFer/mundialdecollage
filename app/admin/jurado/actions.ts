'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidEmail } from '@/lib/resend'
import { isAdminUser } from '@/lib/jury'

// Jurors are managed only from here; a Server Action is reachable on its own,
// so each one checks for an admin session first.
async function adminDb() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!isAdminUser(user)) throw new Error('Not authorized')
  return createAdminClient()
}

const back = (message: string) => redirect(`/admin/jurado?error=${encodeURIComponent(message)}`)

export async function addJuror(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim().slice(0, 120) || null
  if (!isValidEmail(email)) back('Ese email no es válido.')
  const db = await adminDb()
  // Re-adding someone who was deactivated turns them back on.
  const { error } = await db.from('jurors').upsert({ email, name, active: true }, { onConflict: 'email' })
  if (error) back(error.message)
  revalidatePath('/admin/jurado')
}

// Deactivated, not deleted: their scores stay on record but stop counting.
export async function setJurorActive(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const active = formData.get('active') === '1'
  if (!id) return
  const db = await adminDb()
  const { error } = await db.from('jurors').update({ active }).eq('id', id)
  if (error) back(error.message)
  revalidatePath('/admin/jurado')
}
