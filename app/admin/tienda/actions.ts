'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Marks a store shipment as sent, with an optional tracking code. Runs on the
// admin's own session: shipments' RLS only lets admins update it.
export async function markShipmentSent(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tracking = String(formData.get('tracking_code') ?? '').trim().slice(0, 120)
  if (!id) return
  const supabase = await createClient()
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'shipped', shipped_at: new Date().toISOString(), tracking_code: tracking || null })
    .eq('id', id)
    .in('status', ['pending', 'packed'])
  if (error) redirect(`/admin/tienda?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/tienda')
}

// Back to «para despachar» when it was marked by mistake.
export async function undoShipmentSent(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  const { error } = await supabase
    .from('shipments')
    .update({ status: 'pending', shipped_at: null })
    .eq('id', id)
    .eq('status', 'shipped')
  if (error) redirect(`/admin/tienda?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/tienda')
}
