import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), resolve: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ upsert: mocks.upsert, select: () => { const query = { eq: () => query, maybeSingle: mocks.resolve }; return query } }) }) }))
import { recordCustomerPaymentError } from './customer-payment-errors'
beforeEach(() => { vi.resetAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); vi.spyOn(console, 'error').mockImplementation(() => {}) })
it('stores only safe diagnostic fields and deduplicates provider events', async () => {
  await recordCustomerPaymentError({ customerId: 'customer', eventKey: 'charge:1', stage: 'recurring_payment', error: { message: 'Rejected buyer@example.com', status: 400, body: { secret: 'private' } } })
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 'customer', event_key: 'charge:1', message: 'Rejected [email]', http_status: 400 }), { onConflict: 'event_key', ignoreDuplicates: true })
  expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain('private')
})
it('resolves webhook errors to their customer and subscription', async () => {
  mocks.resolve.mockResolvedValue({ data: { id: 'subscription', customer_id: 'customer' }, error: null })
  await recordCustomerPaymentError({ providerSubscriptionId: 'provider', stage: 'sync_subscription', error: new Error('Failure') })
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ customer_id: 'customer', subscription_id: 'subscription', event_key: null }), expect.anything())
})
it('ignores unrecognized subscriptions and never breaks checkout on storage failure', async () => {
  mocks.resolve.mockResolvedValue({ data: null, error: null })
  await recordCustomerPaymentError({ providerSubscriptionId: 'unknown', stage: 'sync_subscription', error: null })
  expect(mocks.upsert).not.toHaveBeenCalled()
  mocks.upsert.mockRejectedValue(new Error('DB unavailable'))
  await expect(recordCustomerPaymentError({ customerId: 'customer', stage: 'create_preapproval', error: null })).resolves.toBeUndefined()
})

it('stores PayPal with the same fields without labeling it Mercado Pago', async () => {
  await recordCustomerPaymentError({ provider: 'paypal', customerId: 'customer', stage: 'create_preapproval', error: { status: 422, message: 'UNPROCESSABLE_ENTITY', causes: [{ code: 'PAYMENT_SOURCE_DECLINED' }] } })
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ provider: 'paypal', http_status: 422, codes: ['PAYMENT_SOURCE_DECLINED'] }), expect.anything())
})
