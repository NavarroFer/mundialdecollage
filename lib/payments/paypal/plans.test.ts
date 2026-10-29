import { afterEach, describe, expect, it } from 'vitest'
import { paypalPlanId } from './plans'

afterEach(() => {
  delete process.env.PAYPAL_PLAN_ID_CLUB_MONTHLY
  delete process.env.PAYPAL_PLAN_ID_CLUB_ANNUAL
})

describe('paypalPlanId', () => {
  it('maps the Club billing cycles to dedicated provider plans', () => {
    process.env.PAYPAL_PLAN_ID_CLUB_MONTHLY = 'P-MONTHLY'
    process.env.PAYPAL_PLAN_ID_CLUB_ANNUAL = 'P-ANNUAL'
    expect(paypalPlanId('club-monthly')).toBe('P-MONTHLY')
    expect(paypalPlanId('club-annual')).toBe('P-ANNUAL')
  })
})
