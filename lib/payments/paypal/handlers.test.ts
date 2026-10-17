import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db }))
vi.mock('@/lib/customer-payment-errors', () => ({ recordCustomerPaymentError: vi.fn() }))
vi.mock('@/lib/subscription-receipts', () => ({ sendSubscriptionReceipt: vi.fn() }))
const donation = vi.hoisted(() => ({ applyPayment: vi.fn() }))
vi.mock('@/lib/donation-payments', () => ({ donationPurchase: donation }))

import { handlePaypalEvent } from './handlers'

beforeEach(() => {
  db.rpc.mockReset().mockResolvedValue({ error: null })
  db.from.mockReset()
  donation.applyPayment.mockReset().mockResolvedValue('paid')
})

const captured = (custom_id: string) => ({
  id: 'WH-1',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: { id: 'CAP1', custom_id, amount: { value: '10.00', currency_code: 'USD' } },
})

describe('PayPal capture events', () => {
  it('records a donation on its own: it is no order of ours', async () => {
    await handlePaypalEvent(captured('donacion:7d2c0a4e-0000-4000-8000-000000000000'))
    expect(donation.applyPayment).toHaveBeenCalledWith('7d2c0a4e-0000-4000-8000-000000000000', expect.objectContaining({ provider: 'paypal', id: 'CAP1', amount: 10, currency: 'USD' }))
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })

  it('fails the event when the donation could not be recorded, so PayPal sends it again', async () => {
    donation.applyPayment.mockResolvedValue(null)
    await expect(handlePaypalEvent(captured('donacion:7d2c0a4e-0000-4000-8000-000000000000'))).rejects.toThrow('Could not record donation')
  })

  it('records a store order’s payment', async () => {
    await handlePaypalEvent(captured('order-1'))
    expect(db.rpc).toHaveBeenCalledWith('record_paypal_order_payment', expect.objectContaining({ p_payment_id: 'CAP1', p_order_id: 'order-1', p_amount: 10, p_currency: 'USD' }))
  })
})
