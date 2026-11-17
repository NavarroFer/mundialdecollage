import { describe, expect, it } from 'vitest'
import { clubBanner } from './offer-banners'

describe('clubBanner', () => {
  it('takes a member to their own gallery, open Club or not', () => {
    expect(clubBanner('active', true)).toEqual({ kind: 'member', href: '/mi-galeria' })
    expect(clubBanner('active', false)).toEqual({ kind: 'member', href: '/mi-galeria' })
  })

  it('pitches the Club to an artist without a gallery while it is open', () => {
    expect(clubBanner(null, true)).toEqual({ kind: 'pitch', href: '/club' })
  })

  it('sends a draft or paused gallery to /mi-galeria, which says what is missing', () => {
    expect(clubBanner('inactive', true)).toEqual({ kind: 'pitch', href: '/mi-galeria' })
  })

  it('shows nothing about the Club while it is closed, unless the gallery is active', () => {
    expect(clubBanner(null, false)).toBeNull()
    expect(clubBanner('inactive', false)).toBeNull()
  })
})
