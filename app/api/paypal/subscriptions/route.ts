import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertCustomer } from '@/lib/payments/customers'
import { paypal, isPayPalServerConfigured } from '@/lib/payments/paypal/client'
import { paypalPlanId, type PaypalPlanKey } from '@/lib/payments/paypal/plans'
import { addressSchema, customerSchema, toPaypalAddress } from '@/lib/payments/validation'
import { z } from 'zod'
import { recordCustomerPaymentError, type PaymentErrorStage } from '@/lib/customer-payment-errors'
import { subscriptionCheckoutError } from '@/lib/subscription-checkout-error'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'

const bodySchema = z.object({ customer: customerSchema, shipping: addressSchema, plan: z.enum(['inicial', 'miembro', 'socio-premium']) })

export async function POST(request: Request) {
  if (!isPayPalServerConfigured) return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { customer, shipping, plan } = parsed.data
  const planId = paypalPlanId(plan as PaypalPlanKey)
  if (!planId) return NextResponse.json({ error: 'This PayPal plan is not configured' }, { status: 503 })

  let customerId: string | undefined
  let subscriptionId: string | undefined
  let stage: PaymentErrorStage = 'create_subscription'
  try {
    customerId = await upsertCustomer(customer.email, `${customer.given_name} ${customer.surname}`)
    const supabase = createAdminClient()
    const { data: local, error: localError } = await supabase
      .from('subscriptions')
      .insert({ customer_id: customerId, provider_plan_id: planId, shipping_address: shipping })
      .select('id')
      .single()
    if (localError || !local) throw new Error(localError?.message ?? 'Could not create local subscription')

    subscriptionId = local.id
    stage = 'create_preapproval'
    const subscription = await paypal<{ id: string }>('/v1/billing/subscriptions', {
      method: 'POST',
      requestId: `subscription-${local.id}`,
      body: {
        plan_id: planId,
        custom_id: local.id,
        subscriber: {
          name: { given_name: customer.given_name, surname: customer.surname },
          email_address: customer.email,
          shipping_address: toPaypalAddress(shipping),
        },
        application_context: {
          brand_name: process.env.BRAND_NAME ?? 'Mundial de Collage',
          shipping_preference: 'SET_PROVIDED_ADDRESS',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${getSiteUrl()}/gracias?tipo=suscripcion`,
          cancel_url: `${getSiteUrl()}/tienda?cancelado=1`,
        },
      },
    })
    stage = 'save_preapproval'
    const { error: updateError } = await supabase.from('subscriptions').update({ provider_subscription_id: subscription.id }).eq('id', local.id)
    if (updateError) throw new Error(updateError.message)
    return NextResponse.json({ id: subscription.id })
  } catch (error) {
    console.error('paypal subscription creation failed', subscriptionCheckoutError(stage, error))
    await recordCustomerPaymentError({ provider: 'paypal', customerId, subscriptionId, stage, error })
    return NextResponse.json({ error: 'Could not create subscription' }, { status: 502 })
  }
}
