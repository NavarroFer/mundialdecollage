import { describe, expect, it } from 'vitest'
import { isFunnelEvent } from './funnel'
import { WAITLIST_SOURCES } from './waitlist'

describe('isFunnelEvent', () => {
  it('accepts the public discovery and completed-onboarding events', () => {
    expect(isFunnelEvent('artist_profile_view')).toBe(true)
    expect(isFunnelEvent('artwork_participate_click')).toBe(true)
    expect(isFunnelEvent('signup_done')).toBe(true)
  })

  it('rejects arbitrary event names', () => {
    expect(isFunnelEvent('checkout_started')).toBe(false)
    expect(isFunnelEvent(null)).toBe(false)
  })
})

describe('waitlist sources', () => {
  it('each «Avisame» source has its own funnel step', () => {
    for (const source of WAITLIST_SOURCES) expect(isFunnelEvent(`waitlist_signup_${source}`)).toBe(true)
  })
})
