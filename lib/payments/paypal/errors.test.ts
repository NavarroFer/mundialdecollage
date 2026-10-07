import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ record: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/customer-payment-errors', () => ({ recordCustomerPaymentError: mocks.record }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ update: mocks.update }) }) }))
vi.mock('@/lib/subscription-receipts', () => ({ sendSubscriptionReceipt: vi.fn() }))
import { handlePaypalEvent } from './handlers'
beforeEach(() => { vi.resetAllMocks(); mocks.update.mockReturnValue({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) })
it('records verified PayPal failed monthly charges with the common contract and event identity', async () => {
  await handlePaypalEvent({ id: 'event-1', event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', resource: { id: 'I-subscription', subscriber: { email_address: 'private@example.com' } } })
  expect(mocks.record).toHaveBeenCalledWith({ provider: 'paypal', providerSubscriptionId: 'I-subscription', eventKey: 'paypal:event:event-1', stage: 'recurring_payment', error: { message: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' } })
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'past_due' }))
  expect(JSON.stringify(mocks.record.mock.calls)).not.toContain('private@example.com')
})
