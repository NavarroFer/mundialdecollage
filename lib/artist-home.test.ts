import { describe, expect, it } from 'vitest'
import { artistSeesFeedHome, canSeeObraFeed } from './artist-home'

const base = { signedIn: true, participating: true, admin: false, adminView: false, forceSite: false }

describe('canSeeObraFeed', () => {
  it('is only for a participating artist or an admin looking as an artist', () => {
    expect(canSeeObraFeed(base)).toBe(true)
    expect(canSeeObraFeed({ ...base, participating: false })).toBe(false)
    expect(canSeeObraFeed({ ...base, signedIn: false })).toBe(false)
    expect(canSeeObraFeed({ ...base, admin: true, adminView: true, participating: false })).toBe(false)
    expect(canSeeObraFeed({ ...base, admin: true, adminView: false, participating: false })).toBe(true)
  })
})

describe('artistSeesFeedHome', () => {
  it('gives the feed to someone who already submitted an obra', () => {
    expect(artistSeesFeedHome(base)).toBe(true)
  })

  it('keeps the public home for a visitor and for someone who has not submitted', () => {
    expect(artistSeesFeedHome({ ...base, signedIn: false })).toBe(false)
    expect(artistSeesFeedHome({ ...base, participating: false })).toBe(false)
  })

  it('opens the public page when they ask for it', () => {
    expect(artistSeesFeedHome({ ...base, forceSite: true })).toBe(false)
  })
})
