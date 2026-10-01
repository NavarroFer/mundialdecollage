import { Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { entryPaymentOutcome, parseExternalReference, type EntryPurchaseStatus } from '@/lib/entries'
import { formatAddress, formatMoney, localeFromCountry, sendReceiptOnce } from '@/lib/receipts'
import { site } from '@/lib/site'

type MercadoPagoPayment = Awaited<ReturnType<Payment['get']>>

// Applies a payment Mercado Pago itself returned (never a webhook body) to
// the magazine order it references — same rules as lib/entry-payments.ts:
// shared by the webhook and by /revista/gracias, and idempotent.
export async function applyMagazinePayment(payment: MercadoPagoPayment): Promise<EntryPurchaseStatus | null> {
  const reference = parseExternalReference(payment.external_reference)
  if (reference?.kind !== 'magazine') return null

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('magazine_orders')
    .select('id, status, amount, currency, mp_payment_id')
    .eq('id', reference.id)
    .maybeSingle()
  if (!order) {
    console.warn('magazine payment: no order found for', reference.id)
    return null
  }

  const outcome = entryPaymentOutcome(payment, order)
  if (outcome === 'mismatch') {
    console.error('magazine payment: amount or currency does not match the order', {
      order: order.id,
      payment: payment.id,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    })
    return order.status
  }
  if (outcome === order.status && (outcome !== 'pending' || order.mp_payment_id === String(payment.id))) {
    // Already paid: the receipt may still be owed if its first send failed.
    if (outcome === 'paid') await sendMagazineReceipt(order.id)
    return outcome
  }

  const update: Record<string, unknown> = { status: outcome, mp_payment_id: String(payment.id) }
  if (outcome === 'paid') update.paid_at = new Date().toISOString()

  const { error } = await admin.from('magazine_orders').update(update).eq('id', order.id)
  if (error) {
    console.error('magazine payment: failed to update order', order.id, error)
    return order.status
  }
  if (outcome === 'paid') await sendMagazineReceipt(order.id)
  return outcome
}

// «¡Gracias! Tu revista está reservada» (compra_revista).
function sendMagazineReceipt(orderId: string) {
  return sendReceiptOnce('magazine_orders', orderId, 'compra_revista', async (db) => {
    const { data: order } = await db.from('magazine_orders')
      .select('id, name, email, quantity, amount, currency, shipping_address')
      .eq('id', orderId)
      .single()
    if (!order) return null
    const address = order.shipping_address as Record<string, unknown>
    const locale = localeFromCountry(typeof address?.country_code === 'string' ? address.country_code : 'AR')
    const total = formatMoney(Number(order.amount), order.currency, locale)
    return {
      to: order.email,
      name: order.name,
      locale,
      tags: {
        ejemplares: String(order.quantity),
        total,
        direccion: formatAddress(address, locale),
        pedido: order.id.slice(0, 8).toUpperCase(),
        fecha_salida: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(site.magazine.releaseISO)),
      },
      summary: `Revista · ${order.quantity} ${order.quantity === 1 ? 'ejemplar' : 'ejemplares'} · ${total} · ${order.name}`,
    }
  })
}

export async function syncMagazinePaymentById(paymentId: string) {
  if (!isMercadoPagoConfigured || !/^\d+$/.test(paymentId)) return null
  try {
    const payment = await new Payment(getMercadoPagoConfig()).get({ id: paymentId })
    return await applyMagazinePayment(payment)
  } catch (err) {
    console.error('magazine payment: failed to fetch payment', paymentId, err)
    return null
  }
}
