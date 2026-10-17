'use server'

import { revalidatePath } from 'next/cache'
import { ADMIN_EMAILS } from '@/lib/admin'
import { recoverMercadoPago, type Recovered } from '@/lib/payments/recover'
import { createClient } from '@/lib/supabase/server'

export type RecoverPaymentsState = { found: Recovered | null; error: boolean }

// «Buscar en Mercado Pago»: brings what its notifications left out
// (lib/payments/recover.ts). Only runs when tapped.
export async function recoverPayments(): Promise<RecoverPaymentsState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return { found: null, error: true }
  try {
    const found = await recoverMercadoPago()
    revalidatePath('/admin/estadisticas')
    return { found, error: false }
  } catch (err) {
    console.error('recoverPayments: Mercado Pago search failed', err)
    return { found: null, error: true }
  }
}
