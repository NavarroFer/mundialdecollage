import { describe, expect, it } from 'vitest'
import { artistProfileIdFromSlug, artistProfileSlug } from './artist-profiles'

const PROFILE_ID = '85f7cd7d-ec3e-4f98-99c8-d18fa09a671a'

describe('artistProfileSlug', () => {
  it('combines a readable name with the stable profile id', () => {
    expect(artistProfileSlug('Sofía Ramírez', PROFILE_ID)).toBe(`sofia-ramirez-${PROFILE_ID}`)
  })

  it('keeps a usable prefix when the artist name has no URL-safe characters', () => {
    expect(artistProfileSlug('---', PROFILE_ID)).toBe(`artista-${PROFILE_ID}`)
  })
})

describe('artistProfileIdFromSlug', () => {
  it('recovers the profile id even if the readable name changed', () => {
    expect(artistProfileIdFromSlug(`nombre-anterior-${PROFILE_ID}`)).toBe(PROFILE_ID)
  })

  it('rejects a route without a valid UUID suffix', () => {
    expect(artistProfileIdFromSlug('sofia-ramirez')).toBeUndefined()
  })
})
