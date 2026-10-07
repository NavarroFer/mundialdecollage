import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  record: vi.fn(),
}))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/track-server', () => ({ recordFunnelEvent: mocks.record }))

const vid = '550e8400-e29b-41d4-a716-446655440000'
function request(payload: unknown, cookie = '') {
  return new NextRequest('https://site.test/api/track', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(payload),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } } })
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
})

describe('POST /api/track', () => {
  it('records anonymous visits without constructing an Auth client', async () => {
    expect((await POST(request({ name: 'home_view', vid }, 'mdc-ref=ana-luz'))).status).toBe(204)
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.record).toHaveBeenCalledWith('home_view', vid, null)
  })
  it('verifies signed-in attribution instead of trusting the payload', async () => {
    expect((await POST(request({ name: 'home_view', vid, userId: 'forged' }, 'sb-abc-auth-token.0=session'))).status).toBe(204)
    expect(mocks.getUser).toHaveBeenCalledOnce()
    expect(mocks.record).toHaveBeenCalledWith('home_view', vid, 'verified-user')
  })
  it('rejects malformed visitor IDs before doing Auth or database work', async () => {
    expect((await POST(request({ name: 'home_view', vid: 'bad' }, 'sb-abc-auth-token=session'))).status).toBe(400)
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.record).not.toHaveBeenCalled()
  })
})
