'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ADMIN_EMAILS } from '@/lib/admin'
import { MAIL_PROVIDERS, type MailProvider } from '@/lib/mail-quota'

async function assertAdmin() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) throw new Error('Not authorized')
}

const back = (error?: string) => redirect(error ? `/admin/envios?error=${encodeURIComponent(error)}` : '/admin/envios?guardado=1')

// Blank means "no limit"; anything else a whole number ≥ min.
function limit(formData: FormData, name: string, min: number): number | null | 'invalid' {
  const raw = String(formData.get(name) ?? '').trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= min ? n : 'invalid'
}

// A provider's plan and limits, and — when filled — what its dashboard shows
// as used right now, which resets the app's counter to match.
export async function updateMailProvider(formData: FormData) {
  await assertAdmin()
  const provider = String(formData.get('provider') ?? '') as MailProvider
  if (!MAIL_PROVIDERS.includes(provider)) back('Proveedor desconocido.')

  const daily = limit(formData, 'daily_limit', 1)
  const monthly = limit(formData, 'monthly_limit', 1)
  const cycleDay = limit(formData, 'cycle_day', 1)
  const usedToday = limit(formData, 'used_today', 0)
  const usedCycle = limit(formData, 'used_cycle', 0)
  if ([daily, monthly, cycleDay, usedToday, usedCycle].includes('invalid')) back('Los números tienen que ser enteros, sin puntos ni comas.')
  if (cycleDay !== null && (cycleDay as number) > 28) back('El día de renovación va del 1 al 28.')

  const now = new Date().toISOString()
  const sync = usedToday !== null || usedCycle !== null
  if (sync && (usedToday === null || usedCycle === null)) back('Para sincronizar el consumo completá los dos: usados hoy y en el ciclo.')
  const { error } = await createAdminClient().from('mail_providers').update({
    plan: String(formData.get('plan') ?? '').trim() || null,
    daily_limit: daily,
    monthly_limit: monthly,
    cycle_day: cycleDay ?? 1,
    ...(sync ? { used_today_offset: usedToday ?? 0, used_cycle_offset: usedCycle ?? 0, offset_at: now } : {}),
    updated_at: now,
  }).eq('provider', provider)
  if (error) back(error.message)

  revalidatePath('/admin/envios')
  back()
}
