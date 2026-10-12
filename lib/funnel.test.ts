import { describe, expect, it } from 'vitest'
import { FUNNEL_EVENT_NAMES, galleryReadyEvent, isFunnelEvent } from './funnel'
import { VISIT_SOURCES } from './visit-source'
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

describe('event names', () => {
  it('all fit funnel_events.name (letters and underscores, 3 to 40)', () => {
    for (const name of FUNNEL_EVENT_NAMES) expect(name).toMatch(/^[a-z_]{3,40}$/)
  })

  it('each visit source has its own sign-up step', () => {
    for (const source of VISIT_SOURCES) expect(isFunnelEvent(`signup_source_${source}`)).toBe(true)
  })
})

describe('galleryReadyEvent', () => {
  it('puts the load time in its range', () => {
    expect(galleryReadyEvent(1200)).toBe('gallery_ready_fast')
    expect(galleryReadyEvent(3000)).toBe('gallery_ready_ok')
    expect(galleryReadyEvent(12000)).toBe('gallery_ready_slow')
    expect(galleryReadyEvent(45000)).toBe('gallery_ready_very_slow')
  })
})
