import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ record: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/customer-payment-errors', () => ({ recordCustomerPaymentError: mocks.record }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/mercadopago', () => ({ isMercadoPagoConfigured: true, getMercadoPagoConfig: () => ({}) }))
import { recordAuthorizedPayment } from './mp-subscriptions'
beforeEach(() => { vi.resetAllMocks(); mocks.rpc.mockResolvedValue({ error: null }) })
it('keeps rejected monthly charges in customer history without creating a shipment', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preapproval_id: 'subscription', payment: { id: 42, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' } }) }))
  await recordAuthorizedPayment('123')
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ providerSubscriptionId: 'subscription', eventKey: 'mp:charge:123:42:rejected', stage: 'recurring_payment' }))
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('still records approved charges through the existing payment and shipment transaction', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preapproval_id: 'subscription', transaction_amount: 15000, currency_id: 'ARS', payment: { id: 42, status: 'approved' } }) }))
  await recordAuthorizedPayment('123')
  expect(mocks.rpc).toHaveBeenCalledWith('record_subscription_payment', expect.objectContaining({ p_payment_id: '42', p_amount: 15000, p_subscription_provider_id: 'subscription' }))
  expect(mocks.record).not.toHaveBeenCalled()
})
