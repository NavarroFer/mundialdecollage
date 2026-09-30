import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertCustomer } from '@/lib/payments/customers'
import { isPayPalServerConfigured, paypal } from '@/lib/payments/paypal/client'
import { addressSchema, customerSchema, toPaypalAddress } from '@/lib/payments/validation'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'

const bodySchema = z.object({
  customer: customerSchema,
  shipping: addressSchema,
  items: z.array(z.object({ product_id: z.string().min(1), qty: z.number().int().min(1).max(20) })).min(1),
})
const money = (amount: number) => amount.toFixed(2)

export async function POST(request: Request) {
  if (!isPayPalServerConfigured) return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { customer, shipping, items } = parsed.data
  const supabase = createAdminClient()
  const ids = [...new Set(items.map((item) => item.product_id))]
  const { data: products, error: productsError } = await supabase.from('products').select('id, name, price, currency').in('id', ids).eq('active', true)
  if (productsError || !products || products.length !== ids.length || products.some((product) => product.currency !== 'USD')) {
    return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
  }
  const lines = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.product_id)!
    return { product_id: product.id, name: product.name, qty: item.qty, unit_price: Number(product.price) }
  })
  const subtotal = lines.reduce((total, line) => total + line.qty * line.unit_price, 0)
  const { data: rates, error: rateError } = await supabase.from('shipping_rates').select('country_code, price').in('country_code', [shipping.country_code, '*'])
  if (rateError) throw new Error(rateError.message)
  const rate = rates?.find((candidate) => candidate.country_code === shipping.country_code) ?? rates?.find((candidate) => candidate.country_code === '*')
  if (!rate) return NextResponse.json({ error: 'We do not ship to this country' }, { status: 400 })
  const shippingCost = Number(rate.price)

  try {
    const customerId = await upsertCustomer(customer.email, `${customer.given_name} ${customer.surname}`)
    const { data: local, error: insertError } = await supabase
      .from('orders')
      .insert({ customer_id: customerId, items: lines, subtotal, shipping: shippingCost, total: subtotal + shippingCost, shipping_address: shipping })
      .select('id')
      .single()
    if (insertError || !local) throw new Error(insertError?.message ?? 'Could not create local order')
    const order = await paypal<{ id: string }>('/v2/checkout/orders', {
      method: 'POST', requestId: `order-${local.id}`,
      body: {
        intent: 'CAPTURE',
        purchase_units: [{ reference_id: local.id, custom_id: local.id, amount: { currency_code: 'USD', value: money(subtotal + shippingCost), breakdown: { item_total: { currency_code: 'USD', value: money(subtotal) }, shipping: { currency_code: 'USD', value: money(shippingCost) } } }, items: lines.map((line) => ({ name: line.name.slice(0, 127), quantity: String(line.qty), unit_amount: { currency_code: 'USD', value: money(line.unit_price) }, category: 'PHYSICAL_GOODS' })), shipping: toPaypalAddress(shipping) }],
        application_context: { brand_name: process.env.BRAND_NAME ?? 'Mundial de Collage', shipping_preference: 'SET_PROVIDED_ADDRESS', user_action: 'PAY_NOW', return_url: `${getSiteUrl()}/gracias`, cancel_url: `${getSiteUrl()}/tienda` },
      },
    })
    const { error: updateError } = await supabase.from('orders').update({ provider_order_id: order.id }).eq('id', local.id)
    if (updateError) throw new Error(updateError.message)
    return NextResponse.json({ id: order.id })
  } catch (error) {
    console.error('paypal order creation failed', error)
    return NextResponse.json({ error: 'Could not create order' }, { status: 502 })
  }
}
