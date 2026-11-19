import { afterEach, describe, expect, it, vi } from 'vitest'
import { providerPlanLabel } from './provider-plan-label'

afterEach(() => vi.unstubAllEnvs())

describe('providerPlanLabel', () => {
  it('names the PayPal Club plans instead of showing their id', () => {
    vi.stubEnv('PAYPAL_PLAN_ID_CLUB_MONTHLY', 'P-CLUB-M')
    vi.stubEnv('PAYPAL_PLAN_ID_CLUB_ANNUAL', 'P-CLUB-A')
    expect(providerPlanLabel('P-CLUB-M')).toMatch(/^Club mensual · .*15/)
    expect(providerPlanLabel('P-CLUB-A')).toMatch(/^Club anual · .*290/)
  })

  it('names the Mercado Pago Club plans and keeps the store plans', () => {
    expect(providerPlanLabel('mp:club-monthly')).toMatch(/^Club mensual · /)
    expect(providerPlanLabel('mp:miembro')).toBe('Miembro')
  })

  it('falls back to the raw id for an unknown plan', () => {
    expect(providerPlanLabel('P-UNKNOWN')).toBe('P-UNKNOWN')
  })
})
