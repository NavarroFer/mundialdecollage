import { describe, expect, it } from 'vitest'
import { artistSeesFeedHome } from './artist-home'

const base = { signedIn: true, onboarded: true, admin: false, adminView: false, forceSite: false }

describe('artistSeesFeedHome', () => {
  it('gives the feed to an onboarded artist', () => {
    expect(artistSeesFeedHome(base)).toBe(true)
  })

  it('keeps the public home for a visitor and for someone who is not an artist yet', () => {
    expect(artistSeesFeedHome({ ...base, signedIn: false })).toBe(false)
    expect(artistSeesFeedHome({ ...base, onboarded: false })).toBe(false)
  })

  it('lets an admin see the public site, and the feed when they look as an artist', () => {
    expect(artistSeesFeedHome({ ...base, admin: true, adminView: true, onboarded: false })).toBe(false)
    expect(artistSeesFeedHome({ ...base, admin: true, adminView: false, onboarded: false })).toBe(true)
  })

  it('opens the public page when the artist asks for it', () => {
    expect(artistSeesFeedHome({ ...base, forceSite: true })).toBe(false)
  })
})
