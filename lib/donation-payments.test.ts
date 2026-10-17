import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderPayment } from './payments/provider'

const db = vi.hoisted(() => ({
  previous: null as Record<string, unknown> | null,
  upsert: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.previous, error: null }) }) }),
      upsert: db.upsert,
    }),
  }),
}))

import { donationPurchase, donationStatus } from './donation-payments'

const ID = '7d2c0a4e-0000-4000-8000-000000000000'
const payment = (overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
  provider: 'mercadopago',
  id: '111',
  status: 'approved',
  amount: 10000,
  currency: 'ARS',
  reference: `donacion:${ID}`,
  paidAt: '2026-10-16T12:00:00.000-03:00',
  payer: { email: 'ana@example.com', name: null },
  ...overrides,
})

beforeEach(() => {
  db.previous = null
  db.upsert.mockReset().mockResolvedValue({ error: null })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('donationStatus', () => {
  it('reads the payment, with no price to check it against', () => {
    expect(donationStatus(null, { status: 'approved' })).toBe('paid')
    expect(donationStatus(null, { status: 'rejected' })).toBe('failed')
    expect(donationStatus(null, { status: 'pending' })).toBe('pending')
    expect(donationStatus('failed', { status: 'approved' })).toBe('paid')
  })

  it('never takes a paid donation back, except with a refund', () => {
    expect(donationStatus('paid', { status: 'rejected' })).toBe('paid')
    expect(donationStatus('paid', { status: 'pending' })).toBe('paid')
    expect(donationStatus('paid', { status: 'refunded' })).toBe('refunded')
    expect(donationStatus('refunded', { status: 'approved' })).toBe('refunded')
  })
})

describe('donationPurchase.applyPayment', () => {
  it('records the first payment of a donation, dated when it was paid', async () => {
    expect(await donationPurchase.applyPayment(ID, payment())).toBe('paid')
    expect(db.upsert).toHaveBeenCalledWith({
      id: ID,
      provider: 'mercadopago',
      provider_payment_id: '111',
      status: 'paid',
      amount: 10000,
      currency: 'ARS',
      payer_email: 'ana@example.com',
      payer_name: null,
      paid_at: '2026-10-16T12:00:00.000-03:00',
      created_at: '2026-10-16T12:00:00.000-03:00',
    }, { onConflict: 'id' })
  })

  it('writes nothing for the same payment again or a stray one once paid', async () => {
    db.previous = { status: 'paid', provider_payment_id: '111' }
    expect(await donationPurchase.applyPayment(ID, payment())).toBe('paid')
    expect(await donationPurchase.applyPayment(ID, payment({ id: '99', status: 'rejected' }))).toBe('paid')
    expect(db.upsert).not.toHaveBeenCalled()
  })

  it('moves a failed attempt to paid, keeping its first date', async () => {
    db.previous = { status: 'failed', provider_payment_id: '99' }
    await donationPurchase.applyPayment(ID, payment())
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', provider_payment_id: '111' }), { onConflict: 'id' })
    expect(db.upsert.mock.calls[0][0]).not.toHaveProperty('created_at')
  })

  it('keeps who paid when the provider leaves it out (PayPal)', async () => {
    db.previous = { status: 'pending', provider_payment_id: 'CAP1' }
    await donationPurchase.applyPayment(ID, payment({ provider: 'paypal', id: 'CAP1', payer: undefined }))
    expect(db.upsert.mock.calls[0][0]).not.toHaveProperty('payer_email')
  })

  it('refuses what is not a donation id, and says when it could not record', async () => {
    expect(await donationPurchase.applyPayment('not-a-uuid', payment())).toBeNull()
    db.upsert.mockResolvedValue({ error: { message: 'down' } })
    expect(await donationPurchase.applyPayment(ID, payment())).toBeNull()
  })
})
