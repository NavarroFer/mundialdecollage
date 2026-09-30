import { NextRequest, NextResponse } from 'next/server'
import { Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { parseSignatureHeader, verifyMercadoPagoSignature } from '@/lib/mercadopago-signature'
import { parseExternalReference } from '@/lib/entries'
import { applyEntryPayment } from '@/lib/entry-payments'

// Mercado Pago's server-to-server notification. Historically sent both as a
// JSON body (`{ type: 'payment', data: { id } }`) and as query params
// (`?type=payment&data.id=...`, or the older `?topic=payment&id=...`) — we
// read whichever is present. We always return 200 for anything we recognize
// but don't need to act on (a non-payment notification, an unknown
// registration) so Mercado Pago doesn't retry forever; the only case where we
// intentionally fail the request is a signature mismatch.
export async function POST(request: NextRequest) {
  let type: string | null = null
  let paymentId: string | null = null

  try {
    const body = await request.json()
    type = body?.type ?? body?.topic ?? null
    paymentId = body?.data?.id != null ? String(body.data.id) : null
  } catch {
    // No/invalid JSON body — fall back to query params below.
  }

  if (!paymentId) {
    const params = request.nextUrl.searchParams
    type = type ?? params.get('type') ?? params.get('topic')
    paymentId = params.get('data.id') ?? params.get('id')
  }

  // Not a payment notification (e.g. merchant_order) — nothing to do.
  if (type !== 'payment' || !paymentId) {
    return NextResponse.json({ ok: true })
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error('mercadopago webhook: MERCADOPAGO_WEBHOOK_SECRET not set, refusing unsigned notifications')
    return new NextResponse('Webhook is not configured', { status: 503 })
  }

  const requestId = request.headers.get('x-request-id')
  const { ts, v1 } = parseSignatureHeader(request.headers.get('x-signature'))

  if (!ts || !v1 || !requestId) {
    console.warn('mercadopago webhook: missing signature headers, rejecting')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const valid = verifyMercadoPagoSignature({ paymentId, requestId, ts, v1, secret })

  if (!valid) {
    console.warn('mercadopago webhook: signature mismatch, rejecting')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  if (!isMercadoPagoConfigured) {
    console.error('mercadopago webhook: MERCADOPAGO_ACCESS_TOKEN not set, cannot verify payment', paymentId)
    return NextResponse.json({ ok: true })
  }

  // Never trust the webhook body for amount/status — always re-fetch the
  // authoritative payment record from Mercado Pago's API.
  let payment
  try {
    payment = await new Payment(getMercadoPagoConfig()).get({ id: paymentId })
  } catch (err) {
    console.error('mercadopago webhook: failed to fetch payment', paymentId, err)
    return NextResponse.json({ ok: true })
  }

  const reference = parseExternalReference(payment.external_reference)
  if (!reference) {
    console.warn('mercadopago webhook: payment has no external_reference', payment.id)
    return NextResponse.json({ ok: true })
  }

  // The one-time payment to postulate more obras (app/onboarding/obras).
  if (reference.kind === 'entry') {
    await applyEntryPayment(payment)
    return NextResponse.json({ ok: true })
  }

  const registrationId = reference.id

  const supabase = createAdminClient()
  const { data: registration } = await supabase
    .from('workshop_registrations')
    .select('id, payment_type, amount_total')
    .eq('id', registrationId)
    .maybeSingle()

  if (!registration) {
    console.warn('mercadopago webhook: no registration found for', registrationId)
    return NextResponse.json({ ok: true })
  }

  const amountPaid = payment.transaction_amount ?? 0

  let update: Record<string, unknown>
  if (payment.status === 'approved') {
    const amountPending =
      registration.payment_type === 'sena' ? Math.max(0, registration.amount_total - amountPaid) : 0
    update = {
      status: 'paid',
      mp_payment_id: String(payment.id),
      paid_at: new Date().toISOString(),
      amount_paid: amountPaid,
      amount_pending: amountPending,
    }
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    update = { status: 'failed' }
  } else {
    update = { status: 'pending' }
  }

  const { error: updateError } = await supabase
    .from('workshop_registrations')
    .update(update)
    .eq('id', registrationId)

  if (updateError) {
    console.error('mercadopago webhook: failed to update registration', registrationId, updateError)
  }

  return NextResponse.json({ ok: true })
}
