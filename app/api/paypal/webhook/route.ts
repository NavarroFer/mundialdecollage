import { recordCustomerPaymentError } from '@/lib/customer-payment-errors'
import { subscriptionCheckoutError } from '@/lib/subscription-checkout-error'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handlePaypalEvent } from '@/lib/payments/paypal/handlers'
import { isPayPalServerConfigured, paypal } from '@/lib/payments/paypal/client'

export const runtime = 'nodejs'

type PaypalEvent = { id: string; event_type: string; resource: Record<string, unknown> }

export async function POST(request: Request) {
  if (!isPayPalServerConfigured || !process.env.PAYPAL_WEBHOOK_ID) return new NextResponse('PayPal webhook is not configured', { status: 503 })
  let event: PaypalEvent
  try {
    event = JSON.parse(await request.text()) as PaypalEvent
    if (!event.id || !event.event_type || !event.resource) throw new Error('invalid event')
  } catch {
    return new NextResponse('Invalid webhook body', { status: 400 })
  }

  try {
    const verification = await paypal<{ verification_status: string }>('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo: request.headers.get('paypal-auth-algo'),
        cert_url: request.headers.get('paypal-cert-url'),
        transmission_id: request.headers.get('paypal-transmission-id'),
        transmission_sig: request.headers.get('paypal-transmission-sig'),
        transmission_time: request.headers.get('paypal-transmission-time'),
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      },
    })
    if (verification.verification_status !== 'SUCCESS') return new NextResponse('Invalid webhook signature', { status: 400 })

    const supabase = createAdminClient()
    const { data: inserted, error: eventError } = await supabase
      .from('webhook_events')
      .insert({ id: event.id, event_type: event.event_type, payload: event })
      .select('id')
      .maybeSingle()
    if (eventError?.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    if (eventError || !inserted) throw new Error(eventError?.message ?? 'Could not save webhook event')

    try {
      await handlePaypalEvent(event)
    } catch (error) {
      const providerSubscriptionId = event.event_type.startsWith('BILLING.SUBSCRIPTION.') ? event.resource.id : event.resource.billing_agreement_id
      if (typeof providerSubscriptionId === 'string') await recordCustomerPaymentError({ provider: 'paypal', providerSubscriptionId, eventKey: `paypal:handling:${event.id}`, stage: event.event_type.startsWith('BILLING.SUBSCRIPTION.') ? 'sync_subscription' : 'record_payment', error })
      await supabase.from('webhook_events').delete().eq('id', event.id)
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('paypal webhook failed', event.event_type, subscriptionCheckoutError('sync_subscription', error))
    return new NextResponse('Webhook handling failed', { status: 500 })
  }
}
