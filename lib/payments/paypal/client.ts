const baseUrl = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

let cachedToken: { value: string; expiresAt: number } | null = null

export const isPayPalServerConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
export const isPayPalCheckoutConfigured = Boolean(
  isPayPalServerConfigured &&
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_PLAN_ID_INICIAL &&
    process.env.PAYPAL_PLAN_ID_MIEMBRO &&
    process.env.PAYPAL_PLAN_ID_SOCIO_PREMIUM,
)

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  if (!isPayPalServerConfigured) throw new Error('PayPal server credentials are not configured')

  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status})`)
  const data = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

export async function paypal<T>(path: string, options: { method?: string; body?: unknown; requestId?: string } = {}) {
  const token = await getAccessToken()
  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.requestId ? { 'PayPal-Request-Id': options.requestId } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  })
  const text = await response.text()
  if (!response.ok) {
    // Keep structured provider codes, never the raw body (which can contain payer data).
    let detail: { name?: string; message?: string; details?: Array<{ issue?: string }> } = {}
    try { detail = JSON.parse(text) } catch { /* non-JSON provider response */ }
    throw Object.assign(new Error(detail.name ?? `PayPal request failed (${response.status})`), {
      status: response.status,
      causes: (detail.details ?? []).map((item) => ({ code: item.issue })),
    })
  }
  return (text ? JSON.parse(text) : {}) as T
}
