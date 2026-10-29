import { describe, expect, it } from 'vitest'
import { clubMembershipPlanById, clubMembershipPlans, coinPackById, coinPacks } from './store'

describe('Club catalogue', () => {
  it('keeps the monthly and annual membership decisions explicit', () => {
    expect(clubMembershipPlans).toEqual([
      expect.objectContaining({ id: 'club-monthly', priceArs: 29000, priceUsd: 29, monthsCharged: 1, monthsIncluded: 1, monthlyCoins: 600 }),
      expect.objectContaining({ id: 'club-annual', priceArs: 290000, priceUsd: 290, monthsCharged: 10, monthsIncluded: 12, monthlyCoins: 600 }),
    ])
    expect(clubMembershipPlanById('club-annual')?.billing).toBe('annual')
    expect(clubMembershipPlanById('unknown')).toBeNull()
  })

  it('publishes the three coin packs with their bonuses and local prices', () => {
    expect(coinPacks).toEqual([
      { id: 'chico', coins: 500, priceArs: 5000, priceUsd: 5 },
      { id: 'mediano', coins: 1725, priceArs: 13000, priceUsd: 13 },
      { id: 'mecenas', coins: 4550, priceArs: 30000, priceUsd: 30 },
    ])
    expect(coinPackById('mediano')?.coins).toBe(1725)
    expect(coinPackById('unknown')).toBeNull()
  })
})
