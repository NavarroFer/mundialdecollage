'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ADMIN_EMAILS } from '@/lib/admin'

const CONFIRMATION = 'FINALIZAR'

async function adminEmail() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) throw new Error('Not authorized')
  return user.email as string
}

// Every page that changes once the call closes: the home's CTAs, the header's
// «Participar», /onboarding and the public obra/artist pages.
function revalidatePublic() {
  revalidatePath('/', 'layout')
}

// «Finalizar convocatoria»: no more obras for the 1st edition. Typed
// confirmation, since it changes the whole public site at once. The
// countdown campaigns still ahead are canceled (nothing left to count down).
export async function closeCall(formData: FormData) {
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== CONFIRMATION) {
    redirect(`/admin/convocatoria?error=${encodeURIComponent(`Escribí ${CONFIRMATION} para confirmar.`)}`)
  }
  const email = await adminEmail()
  const db = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await db.from('call_state').update({ closed_at: now, closed_by: email, updated_at: now }).eq('id', true).is('closed_at', null)
  if (error) redirect(`/admin/convocatoria?error=${encodeURIComponent(error.message)}`)
  await db.from('campaigns').update({ status: 'canceled' }).like('system_key', 'cuenta_regresiva_%').eq('status', 'scheduled')

  revalidatePublic()
  redirect('/admin/convocatoria?cerrada=1')
}

// Undo, for a mistake or an extension: the call takes obras again. Countdown
// campaigns canceled on closing stay canceled (they can be scheduled by hand).
export async function reopenCall() {
  await adminEmail()
  const { error } = await createAdminClient().from('call_state').update({ closed_at: null, closed_by: null, updated_at: new Date().toISOString() }).eq('id', true)
  if (error) redirect(`/admin/convocatoria?error=${encodeURIComponent(error.message)}`)
  revalidatePublic()
  redirect('/admin/convocatoria')
}
