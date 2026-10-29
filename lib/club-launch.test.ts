import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_EMAILS } from './admin'
import { canUseClub, isClubOpen } from './club-launch'

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
