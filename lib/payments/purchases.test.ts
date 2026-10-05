import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderPayment } from './provider'
import { fakeSupabase } from './fake-supabase'

const db = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.current }))

import { paymentOutcome, rowPurchase } from './purchases'

const payment = (overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
  provider: 'mercadopago',
  id: '555',
  status: 'approved',
  amount: 30000,
  currency: 'ARS',
  reference: 'entry:p1',
  ...overrides,
})

describe('paymentOutcome', () => {
  const purchase = { status: 'pending' as const, amount: 30000, currency: 'ARS' }

  it('credits an approved payment for the full price', () => {
    expect(paymentOutcome(payment(), purchase)).toBe('paid')
  })

  it('does not credit a payment for less or in another currency', () => {
    expect(paymentOutcome(payment({ amount: 100 }), purchase)).toBe('mismatch')
    expect(paymentOutcome(payment({ currency: 'USD' }), purchase)).toBe('mismatch')
  })

  it('keeps a paid purchase paid when a late notification says otherwise', () => {
    const paid = { ...purchase, status: 'paid' as const }
    expect(paymentOutcome(payment({ status: 'pending' }), paid)).toBe('paid')
    expect(paymentOutcome(payment({ status: 'rejected' }), paid)).toBe('paid')
  })

  it('undoes a paid purchase only on a refund', () => {
    expect(paymentOutcome(payment({ status: 'refunded' }), { ...purchase, status: 'paid' })).toBe('refunded')
    expect(paymentOutcome(payment({ status: 'refunded' }), purchase)).toBe('pending')
  })

  it('marks rejected payments failed and the rest pending', () => {
    expect(paymentOutcome(payment({ status: 'rejected' }), purchase)).toBe('failed')
    expect(paymentOutcome(payment({ status: 'pending' }), purchase)).toBe('pending')
  })
})

describe('rowPurchase', () => {
  const sendReceipt = vi.fn(async () => {})
  const purchase = rowPurchase({ table: 'entry_purchases', label: 'entry payment', sendReceipt })
  const row = { id: 'p1', status: 'pending', amount: 30000, currency: 'ARS', mp_payment_id: null }

  beforeEach(() => {
    sendReceipt.mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('marks the row paid and mails the receipt', async () => {
    const fake = fakeSupabase({ entry_purchases: row })
    db.current = fake.client
    expect(await purchase.applyPayment('p1', payment())).toBe('paid')
    expect(fake.updates).toEqual([{ table: 'entry_purchases', id: 'p1', values: expect.objectContaining({ status: 'paid', mp_payment_id: '555', paid_at: expect.any(String) }) }])
    expect(sendReceipt).toHaveBeenCalledWith('p1')
  })

  it('only retries the receipt for a row already paid', async () => {
    const fake = fakeSupabase({ entry_purchases: { ...row, status: 'paid', mp_payment_id: '555' } })
    db.current = fake.client
    expect(await purchase.applyPayment('p1', payment())).toBe('paid')
    expect(fake.updates).toEqual([])
    expect(sendReceipt).toHaveBeenCalledWith('p1')
  })

  it('records a pending payment once, by its id', async () => {
    const fake = fakeSupabase({ entry_purchases: row })
    db.current = fake.client
    expect(await purchase.applyPayment('p1', payment({ status: 'pending' }))).toBe('pending')
    expect(fake.updates[0].values).toEqual({ status: 'pending', mp_payment_id: '555' })

    const again = fakeSupabase({ entry_purchases: { ...row, mp_payment_id: '555' } })
    db.current = again.client
    await purchase.applyPayment('p1', payment({ status: 'pending' }))
    expect(again.updates).toEqual([])
    expect(sendReceipt).not.toHaveBeenCalled()
  })

  it('leaves the row alone when the amount does not match', async () => {
    const fake = fakeSupabase({ entry_purchases: row })
    db.current = fake.client
    expect(await purchase.applyPayment('p1', payment({ amount: 1 }))).toBe('pending')
    expect(fake.updates).toEqual([])
    expect(sendReceipt).not.toHaveBeenCalled()
  })

  it('keeps the old status when the update fails, and mails nothing', async () => {
    const fake = fakeSupabase({ entry_purchases: row }, { message: 'boom' })
    db.current = fake.client
    expect(await purchase.applyPayment('p1', payment())).toBe('pending')
    expect(sendReceipt).not.toHaveBeenCalled()
  })

  it('returns null for a purchase that does not exist', async () => {
    db.current = fakeSupabase({}).client
    expect(await purchase.applyPayment('nope', payment())).toBeNull()
  })
})
