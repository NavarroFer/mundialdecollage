import { NextRequest, NextResponse } from 'next/server'
import { isMercadoPagoConfigured } from '@/lib/mercadopago'
import { parseSignatureHeader, verifyMercadoPagoSignature } from '@/lib/mercadopago-signature'
import { syncPayment } from '@/lib/payments/apply'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { recordAuthorizedPayment, syncPreapprovalById } from '@/lib/mp-subscriptions'

// What each notification topic is about, and what to do with the id it
// carries: a payment (applied to whatever its reference points at, see
// lib/payments/apply.ts), a store subscription's preapproval, or one of its
// monthly charges (lib/mp-subscriptions.ts). Each handler re-fetches from
// Mercado Pago and never throws. Any other topic (e.g. merchant_order) needs
// nothing.
const TOPICS: Record<string, (id: string) => Promise<unknown>> = {
  payment: (id) => syncPayment(mercadoPago, id),
  subscription_preapproval: syncPreapprovalById,
  subscription_authorized_payment: recordAuthorizedPayment,
}

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

  // For the subscription topics, paymentId is the preapproval's or the
  // charge's id; the signature covers it the same way.
  const handle = type && Object.hasOwn(TOPICS, type) ? TOPICS[type] : null
  if (!handle || !paymentId) return NextResponse.json({ ok: true })

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

  await handle(paymentId)
  return NextResponse.json({ ok: true })
}
