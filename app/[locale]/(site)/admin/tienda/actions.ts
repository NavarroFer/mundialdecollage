'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAILS } from '@/lib/admin'
import { sendShipmentNotice } from '@/lib/shipment-notices'

async function adminSession() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) throw new Error('Unauthorized')
  return db
}
const fail = (message: string): never => redirect(`/admin/tienda?error=${encodeURIComponent(message)}`)
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export async function markShipmentSent(formData: FormData) {
  const db = await adminSession()
  const id = String(formData.get('id') ?? '')
  const tracking = String(formData.get('tracking_code') ?? '').trim()
  if (!uuid(id)) return
  const { data: shipment } = await db.from('shipments').select('shipping_address').eq('id', id).maybeSingle()
  if (!shipment) return
  const pickup = shipment.shipping_address?.delivery_type === 'branch'
  if ((pickup && !tracking) || (tracking && !/^[a-z0-9-]{5,120}$/i.test(tracking))) fail('Ingresá un código de seguimiento válido antes de marcar el envío.')
  const { data, error } = await db.from('shipments')
    .update({ status: 'shipped', shipped_at: new Date().toISOString(), tracking_code: tracking || null, ...(pickup ? { carrier: 'correo_argentino' } : {}) })
    .eq('id', id).in('status', ['pending', 'packed']).select('id').maybeSingle()
  if (error) fail('No pudimos guardar el despacho.')
  if (data && pickup && !await sendShipmentNotice(id, 'shipped')) {
    revalidatePath('/admin/tienda')
    fail('El despacho quedó guardado, pero no se pudo enviar el aviso. Podés reintentarlo desde Envíos despachados.')
  }
  revalidatePath('/admin/tienda')
}

export async function updateShipmentProgress(formData: FormData) {
  const db = await adminSession()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  const deadline = String(formData.get('pickup_deadline') ?? '')
  if (!uuid(id) || !['awaiting_pickup', 'delivered', 'returned'].includes(status)) fail('Revisá el estado del envío.')
  if (status === 'awaiting_pickup') {
    const parsed = new Date(`${deadline}T12:00:00Z`)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== deadline || deadline < today) fail('Ingresá la fecha límite de retiro confirmada por Correo.')
    const { data: shipment } = await db.from('shipments').select('shipping_address, tracking_code').eq('id', id).maybeSingle()
    if (shipment?.shipping_address?.delivery_type !== 'branch' || !shipment.tracking_code) fail('Este aviso requiere un envío a sucursal con seguimiento.')
  }
  const allowed = status === 'awaiting_pickup' ? ['shipped'] : ['shipped', 'awaiting_pickup']
  const { data, error } = await db.from('shipments')
    .update({ status, ...(status === 'awaiting_pickup' ? { pickup_deadline: deadline } : {}) })
    .eq('id', id).in('status', allowed).select('id').maybeSingle()
  if (error) fail('No pudimos actualizar el estado.')
  if (data && status === 'awaiting_pickup' && !await sendShipmentNotice(id, 'awaiting_pickup')) {
    revalidatePath('/admin/tienda')
    fail('La llegada quedó guardada, pero no se pudo enviar el aviso. Reintentá el aviso desde Envíos despachados.')
  }
  revalidatePath('/admin/tienda')
}

export async function retryShipmentNotice(formData: FormData) {
  const db = await adminSession()
  const id = String(formData.get('id') ?? '')
  if (!uuid(id)) return
  const { data } = await db.from('shipments').select('status').eq('id', id).maybeSingle()
  if (!data || !['shipped', 'awaiting_pickup'].includes(data.status)) return
  if (!await sendShipmentNotice(id, data.status as 'shipped' | 'awaiting_pickup')) fail('No pudimos enviar el aviso. El envío conserva su estado.')
  revalidatePath('/admin/tienda')
}

export async function undoShipmentSent(formData: FormData) {
  const db = await adminSession()
  const id = String(formData.get('id') ?? '')
  if (!uuid(id)) return
  const { error } = await db.from('shipments').update({ status: 'pending', shipped_at: null, pickup_deadline: null })
    .eq('id', id).eq('status', 'shipped')
  if (error) fail('No pudimos deshacer el despacho.')
  revalidatePath('/admin/tienda')
}
