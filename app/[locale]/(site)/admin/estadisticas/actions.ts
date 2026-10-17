'use server'

import { revalidatePath } from 'next/cache'
import { ADMIN_EMAILS } from '@/lib/admin'
import { recoverMercadoPagoDonations } from '@/lib/donation-payments'
import { createClient } from '@/lib/supabase/server'

export type RecoverDonationsState = { found: number | null; error: boolean }

// «Buscar en Mercado Pago»: brings the peso donations whose notification
// left nothing behind (lib/donation-payments.ts). Only runs when tapped.
export async function recoverDonations(): Promise<RecoverDonationsState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) return { found: null, error: true }
  try {
    const found = await recoverMercadoPagoDonations()
    revalidatePath('/admin/estadisticas')
    return { found, error: false }
  } catch (err) {
    console.error('recoverDonations: Mercado Pago search failed', err)
    return { found: null, error: true }
  }
}
