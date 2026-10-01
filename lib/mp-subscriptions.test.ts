import { describe, expect, it } from 'vitest'
import { subscriptionStatusFor } from './mp-subscriptions'
import { mpPlanId, planForProviderPlan } from './subscription-receipts'

describe('subscriptionStatusFor', () => {
  it('maps Mercado Pago preapproval statuses to ours', () => {
    expect(subscriptionStatusFor('authorized')).toBe('active')
    expect(subscriptionStatusFor('paused')).toBe('suspended')
    expect(subscriptionStatusFor('cancelled')).toBe('cancelled')
    expect(subscriptionStatusFor('pending')).toBe('pending')
    expect(subscriptionStatusFor('weird')).toBeNull()
  })
})

describe('planForProviderPlan', () => {
  it('reads Mercado Pago plans in pesos', () => {
    expect(planForProviderPlan(mpPlanId('miembro'))).toMatchObject({ plan: { id: 'miembro' }, amount: 36000, currency: 'ARS' })
    expect(planForProviderPlan('mp:nope')).toBeNull()
  })
})
