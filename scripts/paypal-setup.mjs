// Run once per PayPal environment after setting PAYPAL_ENV,
// PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET:
//   node scripts/paypal-setup.mjs
// It prints the three IDs to copy to .env.local or the production host.

const base = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
const credentials = `${process.env.PAYPAL_CLIENT_ID ?? ''}:${process.env.PAYPAL_CLIENT_SECRET ?? ''}`

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  throw new Error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET before running this script.')
}

async function paypal(path, options = {}) {
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!tokenResponse.ok) throw new Error(`PayPal auth failed: ${await tokenResponse.text()}`)
  const { access_token: token } = await tokenResponse.json()
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', 'PayPal-Request-Id': options.requestId },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) throw new Error(`PayPal ${path} failed: ${await response.text()}`)
  return response.json()
}

const plans = [
  ['INICIAL', 'Inicial', '10.00'],
  ['MIEMBRO', 'Miembro', '36.00'],
  ['SOCIO_PREMIUM', 'Socio Premium', '82.00'],
]

for (const [key, name, value] of plans) {
  const product = await paypal('/v1/catalogs/products', {
    method: 'POST', requestId: `mundial-${key.toLowerCase()}-${process.env.PAYPAL_ENV}`,
    body: { name: `Mundial de Collage — ${name}`, description: 'Monthly physical collage subscription', type: 'PHYSICAL', home_url: process.env.NEXT_PUBLIC_SITE_URL },
  })
  const plan = await paypal('/v1/billing/plans', {
    method: 'POST', requestId: `mundial-${key.toLowerCase()}-usd-${value}-${process.env.PAYPAL_ENV}`,
    body: {
      product_id: product.id, name: `${name} — USD ${value}`, status: 'ACTIVE',
      billing_cycles: [{ frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value, currency_code: 'USD' } } }],
      payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CANCEL', payment_failure_threshold: 2 },
    },
  })
  console.log(`PAYPAL_PLAN_ID_${key}=${plan.id}`)
}
