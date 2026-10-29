import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_EMAILS } from './admin'
import { campaignBlockedByClub, canUseClub, isClubOpen } from './club-launch'

afterEach(() => vi.unstubAllEnvs())

describe('the Club launch switch', () => {
  it('is closed unless CLUB_OPEN is exactly on', () => {
    for (const value of [undefined, '', 'off', 'true', '1', 'ON']) {
      vi.stubEnv('CLUB_OPEN', value as string)
      expect(isClubOpen(), String(value)).toBe(false)
    }
    vi.stubEnv('CLUB_OPEN', 'on')
    expect(isClubOpen()).toBe(true)
  })

  it('lets only the site admins in while it is closed', () => {
    vi.stubEnv('CLUB_OPEN', '')
    expect(canUseClub(ADMIN_EMAILS[0])).toBe(true)
    expect(canUseClub('someone@example.com')).toBe(false)
    expect(canUseClub(null)).toBe(false)
    expect(canUseClub(undefined)).toBe(false)
  })

  it('lets everyone in once it is open', () => {
    vi.stubEnv('CLUB_OPEN', 'on')
    expect(canUseClub('someone@example.com')).toBe(true)
    expect(canUseClub(null)).toBe(true)
  })
})

describe('campaignBlockedByClub', () => {
  it('holds the Club launch mail back until the Club is open', () => {
    vi.stubEnv('CLUB_OPEN', '')
    expect(campaignBlockedByClub('club_prospects')).toContain('CLUB_OPEN=on')
    vi.stubEnv('CLUB_OPEN', 'on')
    expect(campaignBlockedByClub('club_prospects')).toBeNull()
  })

  it('never holds back any other audience', () => {
    vi.stubEnv('CLUB_OPEN', '')
    for (const audience of ['subscribed', 'no_artwork', 'profile_review', 'not_participating', 'multiple_artworks']) {
      expect(campaignBlockedByClub(audience), audience).toBeNull()
    }
  })
})
