import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderPayment } from './payments/provider'

const db = vi.hoisted(() => ({
  row: { id: 'pack-1', status: 'pending', amount: 13000, currency: 'ARS', mp_payment_id: null as string | null },
  updates: [] as Record<string, unknown>[],
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: (columns: string) => ({
        eq: () => ({
          maybeSingle: async () => columns.includes('user_id')
            ? ({ data: { user_id: '7d2c0a4e-0000-4000-8000-000000000001', coins: 1725 }, error: null })
            : ({ data: db.row, error: null }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          db.updates.push(values)
          return { error: null }
        },
      }),
    }),
    rpc: db.rpc,
  }),
}))

import { coinPackPurchase } from './coin-pack-payments'

const payment = (): ProviderPayment => ({
  provider: 'mercadopago',
  id: '555',
  status: 'approved',
  amount: 13000,
  currency: 'ARS',
  reference: 'monedas:pack-1',
})

beforeEach(() => {
  db.row = { id: 'pack-1', status: 'pending', amount: 13000, currency: 'ARS', mp_payment_id: null }
  db.updates = []
  db.rpc.mockReset().mockResolvedValue({ error: null })
})

describe('coinPackPurchase', () => {
  it('marks the purchase paid and credits its ledger reference', async () => {
    expect(await coinPackPurchase.applyPayment('pack-1', payment())).toBe('paid')
    expect(db.updates).toEqual([expect.objectContaining({ status: 'paid', mp_payment_id: '555' })])
    expect(db.rpc).toHaveBeenCalledWith('credit_club_coins', {
      p_user_id: '7d2c0a4e-0000-4000-8000-000000000001',
      p_delta: 1725,
      p_kind: 'purchase',
      p_reference_id: 'coin-pack:pack-1',
    })
  })

  it('retries the idempotent credit when the purchase was already paid', async () => {
    db.row = { ...db.row, status: 'paid', mp_payment_id: '555' }
    expect(await coinPackPurchase.applyPayment('pack-1', payment())).toBe('paid')
    expect(db.updates).toEqual([])
    expect(db.rpc).toHaveBeenCalledOnce()
  })
})
