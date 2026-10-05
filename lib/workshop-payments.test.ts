import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderPayment } from '@/lib/payments/provider'
import { fakeSupabase } from '@/lib/payments/fake-supabase'

const db = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => db.current }))

import { workshopPurchase } from './workshop-payments'

const payment = (overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
  provider: 'mercadopago',
  id: '777',
  status: 'approved',
  amount: 20000,
  currency: 'ARS',
  reference: 'r1',
  ...overrides,
})

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('workshopPurchase', () => {
  it('writes down what is left after a seña', async () => {
    const fake = fakeSupabase({ workshop_registrations: { id: 'r1', payment_type: 'sena', amount_total: 60000 } })
    db.current = fake.client
    expect(await workshopPurchase.applyPayment('r1', payment())).toBe('paid')
    expect(fake.updates[0].values).toMatchObject({ status: 'paid', mp_payment_id: '777', amount_paid: 20000, amount_pending: 40000 })
  })

  it('leaves nothing pending for a full payment', async () => {
    const fake = fakeSupabase({ workshop_registrations: { id: 'r1', payment_type: 'completo', amount_total: 60000 } })
    db.current = fake.client
    await workshopPurchase.applyPayment('r1', payment({ amount: 60000 }))
    expect(fake.updates[0].values).toMatchObject({ amount_pending: 0 })
  })

  it('marks rejections failed and anything else pending', async () => {
    const fake = fakeSupabase({ workshop_registrations: { id: 'r1', payment_type: 'completo', amount_total: 60000 } })
    db.current = fake.client
    expect(await workshopPurchase.applyPayment('r1', payment({ status: 'rejected' }))).toBe('failed')
    expect(await workshopPurchase.applyPayment('r1', payment({ status: 'refunded' }))).toBe('pending')
    expect(fake.updates.map((u) => u.values)).toEqual([{ status: 'failed' }, { status: 'pending' }])
  })

  it('returns null for an unknown registration', async () => {
    const fake = fakeSupabase({})
    db.current = fake.client
    expect(await workshopPurchase.applyPayment('nope', payment())).toBeNull()
    expect(fake.updates).toEqual([])
  })
})
