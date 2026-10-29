import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20261029130000_coin_pack_purchases.sql', 'utf8')

describe('coin pack purchase migration', () => {
  it('locks the persisted coin amounts and prices to the product catalogue', () => {
    expect(sql).toContain("pack_id = 'chico' and coins = 500")
    expect(sql).toContain("currency = 'ARS' and amount = 5000")
    expect(sql).toContain("pack_id = 'mediano' and coins = 1725")
    expect(sql).toContain("currency = 'USD' and amount = 13")
    expect(sql).toContain("pack_id = 'mecenas' and coins = 4550")
    expect(sql).toContain("currency = 'ARS' and amount = 30000")
  })

  it('is owner-readable but never creates a physical shipment', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('user_id = auth.uid()')
    expect(sql).not.toContain('public.shipments')
  })
})
