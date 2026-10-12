import { describe, expect, it } from 'vitest'
import { visitSource } from './visit-source'

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0'
const site = 'https://mundialdecollage.com.ar/'

describe('visitSource', () => {
  it("credits an artist's invitation first, by link or cookie", () => {
    expect(visitSource({ url: `${site}?ref=ana-perez`, referrer: '', userAgent: INSTAGRAM })).toBe('artist')
    expect(visitSource({ url: site, referrer: '', userAgent: SAFARI, referralCookie: true })).toBe('artist')
  })

  it('recognizes our mails by their links', () => {
    expect(visitSource({ url: `${site}tienda?desde=mail`, referrer: '', userAgent: SAFARI })).toBe('email')
    expect(visitSource({ url: `${site}?utm_source=newsletter`, referrer: '', userAgent: SAFARI })).toBe('email')
  })

  it("recognizes Instagram and Facebook by their browsers, tags or referrers", () => {
    expect(visitSource({ url: site, referrer: '', userAgent: INSTAGRAM })).toBe('instagram')
    expect(visitSource({ url: `${site}?utm_source=ig`, referrer: '', userAgent: SAFARI })).toBe('instagram')
    expect(visitSource({ url: site, referrer: 'https://l.instagram.com/', userAgent: SAFARI })).toBe('instagram')
    expect(visitSource({ url: site, referrer: 'https://m.facebook.com/', userAgent: SAFARI })).toBe('facebook')
  })

  it('tells Google search from Gmail', () => {
    expect(visitSource({ url: site, referrer: 'https://www.google.com.ar/', userAgent: SAFARI })).toBe('google')
    expect(visitSource({ url: site, referrer: 'https://mail.google.com/', userAgent: SAFARI })).toBe('email')
  })

  it('calls no referrer, or our own site, direct; anything else other', () => {
    expect(visitSource({ url: site, referrer: '', userAgent: SAFARI })).toBe('direct')
    expect(visitSource({ url: site, referrer: `${site}obras/x`, userAgent: SAFARI })).toBe('direct')
    expect(visitSource({ url: site, referrer: 'https://t.co/abc', userAgent: SAFARI })).toBe('other')
  })
})
