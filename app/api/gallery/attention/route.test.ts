import { NextRequest } from 'next/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
const accountId = '550e8400-e29b-41d4-a716-446655440001'
const body = { accountId, sessionId: '550e8400-e29b-41d4-a716-446655440000', rows: [{ slug: 'obra', mode: 'view', milliseconds: 2500, episodes: 1 }], userId: 'forged' }
function request(payload: unknown = body, origin = 'https://site.test') {
  return new NextRequest('https://site.test/api/gallery/attention', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(payload) })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
  mocks.getUser.mockResolvedValue({ data: { user: { id: accountId } }, error: null })
  mocks.rpc.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())
describe('gallery attention endpoint', () => {
  it('uses the verified account, never an identity from the request', async () => {
    expect((await POST(request())).status).toBe(204)
    expect(mocks.rpc).toHaveBeenCalledWith('record_gallery_attention', { viewer_id: accountId, visit_id: body.sessionId, samples: body.rows })
  })
  it('rejects an account change instead of reassigning buffered observations', async () => {
    expect((await POST(request({ ...body, accountId: body.sessionId }))).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects unauthenticated requests', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects other origins, malformed and oversized bodies before auth', async () => {
    expect((await POST(request(body, 'https://elsewhere.test'))).status).toBe(403)
    expect((await POST(request(null))).status).toBe(400)
    expect((await POST(request('x'.repeat(25000)))).status).toBe(413)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it('keeps development observations out of production data', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await POST(request())).status).toBe(204)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('does not acknowledge a failed database write', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rpc.mockResolvedValue({ error: { code: 'missing_migration' } })
    expect((await POST(request())).status).toBe(503)
    log.mockRestore()
  })
})
