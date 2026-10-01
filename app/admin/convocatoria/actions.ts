'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ADMIN_EMAILS } from '@/lib/admin'
import { sendCertificates } from '@/lib/certificate-mail'

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
// countdown campaigns still ahead are canceled (nothing left to count down),
// and — unless unchecked — the certificates go out right away.
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
  const params = new URLSearchParams({ cerrada: '1' })
  if (formData.get('sendCertificates') === 'on') appendSendResult(params, await trySendCertificates(db))
  redirect(`/admin/convocatoria?${params}`)
}

// «Enviar certificados pendientes»: the ones never sent (artists who joined
// the list later, or a send left unchecked on closing) and the failed ones.
export async function sendPendingCertificates() {
  await adminEmail()
  const db = createAdminClient()
  const { data: state } = await db.from('call_state').select('closed_at').eq('id', true).maybeSingle()
  // The mailed links only work once the call is closed.
  if (!state?.closed_at) redirect(`/admin/convocatoria?error=${encodeURIComponent('Los certificados se envían con la convocatoria cerrada.')}`)
  const params = new URLSearchParams()
  appendSendResult(params, await trySendCertificates(db))
  redirect(`/admin/convocatoria?${params}`)
}

type SendResult = { sent: number; failed: number; firstError: string | null }

// Sending can't undo the closing, so a failure to even start is reported
// on the page instead of thrown.
async function trySendCertificates(db: ReturnType<typeof createAdminClient>): Promise<SendResult> {
  try {
    return await sendCertificates(db)
  } catch (err) {
    console.error('sendCertificates failed', err)
    return { sent: 0, failed: 0, firstError: err instanceof Error ? err.message : String(err) }
  }
}

function appendSendResult(params: URLSearchParams, { sent, failed, firstError }: SendResult) {
  params.set('enviados', String(sent))
  if (failed) params.set('fallidos', String(failed))
  if (firstError) params.set('error', `Certificados: ${firstError}`)
  revalidatePath('/admin/convocatoria')
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
