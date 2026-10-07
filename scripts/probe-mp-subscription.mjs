// node --env-file=<credential file> scripts/probe-mp-subscription.mjs
// Add --payer=<your Mercado Pago email> --execute for a pending checkout probe.
// No card token is sent; any created preapproval is immediately cancelled.
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const token = process.env.MERCADOPAGO_ACCESS_TOKEN
if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN is required')
const headers = { Authorization: `Bearer ${token}` }
const response = await fetch('https://api.mercadopago.com/users/me', { headers, signal: AbortSignal.timeout(15000) })
const account = await response.json()
if (!response.ok) throw new Error(`Account lookup failed (${response.status})`)
console.log(JSON.stringify({ stage: 'account', country: account.site_id, testAccount: account.tags?.includes('test_user') === true }))

if (process.argv.includes('--execute')) {
  const email = process.argv.find((arg) => arg.startsWith('--payer='))?.slice(8)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('--payer must be your Mercado Pago email')
  const reference = `diagnostico:${crypto.randomUUID()}`
  const reportPath = join(tmpdir(), `mundial-mp-${reference.slice(12)}.json`)
  const provider = new PreApproval(new MercadoPagoConfig({ accessToken: token, options: { timeout: 15000 } }))
  let id
  try {
    const result = await provider.create({ body: {
      reason: 'Papel por correo — plan inicial (Mundial de Collage)',
      external_reference: reference,
      payer_email: email,
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 15000, currency_id: 'ARS' },
      back_url: 'https://mundialdecollage.com.ar/gracias?tipo=suscripcion',
      status: 'pending',
    } })
    id = result.id
    if (!id) throw new Error('Mercado Pago returned no subscription ID')
    writeFileSync(reportPath, JSON.stringify({ reference, id, status: result.status }), { mode: 0o600 })
    console.log(JSON.stringify({ stage: 'created', id, status: result.status, hasCheckout: !!result.init_point, reportPath }))
  } catch (error) {
    const message = String(error.message ?? 'Unknown provider error')
      .replace(/(?:APP_USR|TEST)-[\w-]+/g, '[credential]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[email]')
    console.log(JSON.stringify({ stage: 'creation_error', status: error.status, message }))
    // A timed-out POST might have succeeded. Reconcile before finishing.
    const search = await fetch(`https://api.mercadopago.com/preapproval/search?external_reference=${encodeURIComponent(reference)}`, { headers, signal: AbortSignal.timeout(15000) })
    if (!search.ok) throw new Error(`Cannot reconcile probe (${search.status}); reference: ${reference}`)
    const matches = (await search.json()).results ?? []
    for (const match of matches) {
      const cancelled = await provider.update({ id: match.id, body: { status: 'cancelled' } })
      console.log(JSON.stringify({ stage: 'reconciled_cleanup', id: match.id, status: cancelled.status }))
    }
    process.exitCode = 1
  } finally {
    if (id) {
      const cancelled = await provider.update({ id, body: { status: 'cancelled' } })
      const verified = await provider.get({ id })
      writeFileSync(reportPath, JSON.stringify({ reference, id, status: verified.status }), { mode: 0o600 })
      console.log(JSON.stringify({ stage: 'cleanup', id, status: cancelled.status, verifiedStatus: verified.status }))
      if (verified.status !== 'cancelled') throw new Error(`Probe cleanup not confirmed; id: ${id}`)
    }
  }
}
