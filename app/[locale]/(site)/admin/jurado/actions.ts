'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidEmail } from '@/lib/resend'
import { isAdminUser } from '@/lib/jury'
import { parseJurorProfile } from '@/lib/juror-profile'
import { sendJuryInvitation } from '@/lib/jury-mail'

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
  if (!isValidEmail(email)) back('Ese email no es válido.')
  const parsed = parseJurorProfile(formData)
  if ('error' in parsed) return back(parsed.error)
  const db = await adminDb()
  // Only a new juror, or one coming back from deactivated, gets the
  // invitation; re-adding an active one just updates the profile.
  const { data: existing } = await db.from('jurors').select('active').eq('email', email).maybeSingle()
  // Re-adding someone who was deactivated turns them back on.
  const { data: juror, error } = await db.from('jurors')
    .upsert({ email, ...parsed.profile, active: true }, { onConflict: 'email' })
    .select('id, email, name')
    .single()
  if (error || !juror) back(error?.message ?? 'No se pudo guardar el jurado.')
  revalidatePath('/admin/jurado')
  if (!existing?.active) {
    const mailError = await sendJuryInvitation(db, juror!)
    if (mailError) back(`Se sumó a ${email}, pero no se pudo mandar la invitación: ${mailError}`)
  }
}

export async function resendJuryInvitation(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const db = await adminDb()
  const { data: juror } = await db.from('jurors').select('id, email, name').eq('id', id).maybeSingle()
  if (!juror) back('Ese jurado ya no existe.')
  const mailError = await sendJuryInvitation(db, juror!)
  revalidatePath('/admin/jurado')
  if (mailError) back(`No se pudo mandar la invitación a ${juror!.email}: ${mailError}`)
}

// The email stays: it's the Google account the juror signs in with.
export async function updateJurorProfile(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const parsed = parseJurorProfile(formData)
  if ('error' in parsed) return back(parsed.error)
  const db = await adminDb()
  const { error } = await db.from('jurors').update(parsed.profile).eq('id', id)
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
