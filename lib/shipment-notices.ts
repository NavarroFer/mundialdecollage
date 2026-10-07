import { createAdminClient } from '@/lib/supabase/admin'
import { isMailConfigured, sendMail } from '@/lib/mail'
import { formatAddress } from '@/lib/receipts'
import { site } from '@/lib/site'
import { pickupCopy } from '@/lib/pickup-copy'
import { localeFromCountry } from '@/lib/receipts'

/** Admin-confirmed dispatch/arrival. Arrival is never inferred from elapsed time. */
export async function sendShipmentNotice(id: string, event: 'shipped' | 'awaiting_pickup'): Promise<boolean> {
  if (!isMailConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  const db = createAdminClient()
  const column = event === 'shipped' ? 'shipped_notice_sent_at' : 'pickup_notice_sent_at'
  const claimedAt = new Date().toISOString()
  try {
    const { data, error } = await db.from('shipments').update({ [column]: claimedAt })
      .eq('id', id).eq('status', event).is(column, null)
      .select('shipping_address, tracking_code, pickup_deadline, payments!inner(subscriptions(customers(email, full_name)))').maybeSingle()
    if (error) return false
    if (!data) return true
    const payment = data.payments as unknown as { subscriptions: { customers: { email: string; full_name: string } | null } | null }
    const customer = payment?.subscriptions?.customers
    if (!customer?.email || !data.tracking_code) {
      await db.from('shipments').update({ [column]: null }).eq('id', id).eq(column, claimedAt)
      return false
    }
    const locale = localeFromCountry(data.shipping_address?.country_code)
    const p = pickupCopy(locale)
    const es = locale === 'es'
    const arrival = event === 'awaiting_pickup'
    const deadline = data.pickup_deadline ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${data.pickup_deadline}T12:00:00Z`)) : null
    if (arrival && !deadline) {
      await db.from('shipments').update({ [column]: null }).eq('id', id).eq(column, claimedAt)
      return false
    }
    const subject = arrival ? (es ? 'Tu paquete está disponible para retirar' : 'Your parcel is ready for pickup') : (es ? 'Despachamos tu paquete del Mundial de Collage' : 'Your Collage World Cup parcel has shipped')
    const text = [
      customer.full_name, subject,
      formatAddress(data.shipping_address, locale),
      `${es ? 'Seguimiento' : 'Tracking'}: ${data.tracking_code}`,
      'https://www.correoargentino.com.ar/formularios/e-commerce',
      arrival ? `${es ? 'Retirá hasta el' : 'Collect by'} ${deadline}. ${p.identity}` : p.readyHelp,
      arrival ? (es ? 'Si no podés retirarlo, escribinos. Si vence el plazo, Correo puede devolverlo al remitente; coordinaremos las condiciones de reenvío.' : 'Contact us if you cannot collect it. After the deadline, Correo may return the parcel; contact us to arrange reshipping.') : '',
      site.email,
    ].filter(Boolean).join('\n\n')
    const sent = await sendMail({ to: customer.email, subject, text, replyTo: site.email })
    if (!sent.ok) {
      await db.from('shipments').update({ [column]: null }).eq('id', id).eq(column, claimedAt)
      return false
    }
    return true
  } catch {
    await db.from('shipments').update({ [column]: null }).eq('id', id).eq(column, claimedAt)
    return false
  }
}
