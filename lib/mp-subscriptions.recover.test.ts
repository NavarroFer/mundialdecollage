import { beforeEach, describe, expect, it, vi } from 'vitest'

const mp = vi.hoisted(() => ({ get: vi.fn(), search: vi.fn(), invoices: vi.fn() }))
const db = vi.hoisted(() => ({ update: vi.fn(), rpc: vi.fn() }))
const receipt = vi.hoisted(() => vi.fn())
vi.mock('mercadopago', () => ({
  PreApproval: class { get = mp.get; search = mp.search },
  Invoice: class { search = mp.invoices },
}))
vi.mock('@/lib/mercadopago', () => ({ isMercadoPagoConfigured: true, getMercadoPagoConfig: () => ({}) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ update: (row: unknown) => ({ eq: () => ({ eq: () => ({ select: async () => { db.update(row); return { data: [{ id: 's1' }], error: null } } }) }) }) }),
    rpc: db.rpc,
  }),
}))
vi.mock('@/lib/subscription-receipts', () => ({ sendSubscriptionReceipt: receipt }))
vi.mock('@/lib/customer-payment-errors', () => ({ recordCustomerPaymentError: vi.fn() }))

import { recoverMercadoPagoSubscriptions } from './mp-subscriptions'

const ours = { id: 'pre-ours-1', external_reference: 'suscripcion:s1', status: 'authorized' }
const other = { id: 'pre-pampa-1', external_reference: null, status: 'authorized' }

beforeEach(() => {
  mp.get.mockReset().mockResolvedValue({ ...ours, next_payment_date: '2026-11-07T15:27:00.000-04:00' })
  mp.search.mockReset().mockResolvedValue({ results: [ours, other] })
  mp.invoices.mockReset().mockResolvedValue({
    results: [
      { id: '9001', payment: { id: '181911687409', status: 'approved' } },
      { id: '9002', payment: { id: '1', status: 'rejected' } },
    ],
  })
  db.update.mockReset()
  db.rpc.mockReset().mockResolvedValue({ error: null })
  receipt.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({
    id: 9001,
    preapproval_id: 'pre-ours-1',
    transaction_amount: 15000,
    currency_id: 'ARS',
    payment: { id: 181911687409, status: 'approved' },
  })))
})

describe('recoverMercadoPagoSubscriptions', () => {
  it("activates the store's subscriptions and records their approved charges, leaving other businesses' alone", async () => {
    expect(await recoverMercadoPagoSubscriptions()).toEqual({ subscriptions: 1, charges: 1 })
    expect(mp.get).toHaveBeenCalledTimes(1)
    expect(mp.get).toHaveBeenCalledWith({ id: 'pre-ours-1' })
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', provider_subscription_id: 'pre-ours-1' }))
    expect(receipt).toHaveBeenCalledWith('s1')
    expect(mp.invoices).toHaveBeenCalledWith({ options: expect.objectContaining({ preapproval_id: 'pre-ours-1' }) })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(db.rpc).toHaveBeenCalledWith('record_subscription_payment', expect.objectContaining({
      p_payment_id: '181911687409',
      p_subscription_provider_id: 'pre-ours-1',
      p_amount: 15000,
    }))
  })
})
