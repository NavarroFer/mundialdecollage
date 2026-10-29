import { afterEach, describe, expect, it, vi } from 'vitest'
import { isClubProviderPlan } from './club-plans'

afterEach(() => vi.unstubAllEnvs())

describe('isClubProviderPlan', () => {
  it('knows the Mercado Pago Club plans by their prefix and leaves the store plans alone', () => {
    expect(isClubProviderPlan('mp:club-monthly')).toBe(true)
    expect(isClubProviderPlan('mp:club-annual')).toBe(true)
    expect(isClubProviderPlan('mp:miembro')).toBe(false)
    expect(isClubProviderPlan('mp:recortes-200')).toBe(false)
  })

  it('knows the PayPal Club plans by the ids in the environment', () => {
    vi.stubEnv('PAYPAL_PLAN_ID_CLUB_MONTHLY', 'P-CLUB-MONTHLY')
    vi.stubEnv('PAYPAL_PLAN_ID_MIEMBRO', 'P-MIEMBRO')
    expect(isClubProviderPlan('P-CLUB-MONTHLY')).toBe(true)
    expect(isClubProviderPlan('P-MIEMBRO')).toBe(false)
  })

  it('does not take an empty or missing id for a Club plan when the variables are not set', () => {
    vi.stubEnv('PAYPAL_PLAN_ID_CLUB_MONTHLY', '')
    vi.stubEnv('PAYPAL_PLAN_ID_CLUB_ANNUAL', '')
    expect(isClubProviderPlan('')).toBe(false)
    expect(isClubProviderPlan(null)).toBe(false)
    expect(isClubProviderPlan(undefined)).toBe(false)
    expect(isClubProviderPlan('P-ANYTHING')).toBe(false)
  })
})
