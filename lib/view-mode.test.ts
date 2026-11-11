import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const cookieValue = vi.fn<() => string | undefined>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'view_as' ? { value: cookieValue() } : undefined) }),
}))

import { isAdminView } from '@/lib/view-mode'
import { ADMIN_EMAILS } from '@/lib/admin'

const user = (email: string) => ({ email }) as User

describe('isAdminView', () => {
  beforeEach(() => cookieValue.mockReset())

  it('is false for a visitor and for a regular artist, whatever the cookie says', async () => {
    cookieValue.mockReturnValue('admin')
    expect(await isAdminView(null)).toBe(false)
    expect(await isAdminView(user('artista@example.com'))).toBe(false)
  })

  it('shows an admin the admin view unless they chose to look as an artist', async () => {
    cookieValue.mockReturnValue(undefined)
    expect(await isAdminView(user(ADMIN_EMAILS[0]))).toBe(true)
    cookieValue.mockReturnValue('artist')
    expect(await isAdminView(user(ADMIN_EMAILS[0]))).toBe(false)
  })
})
