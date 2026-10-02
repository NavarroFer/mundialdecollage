import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const photo = 'https://abc.supabase.co/storage/v1/object/public/artworks/u1/1-0.jpg'
const request = (url: string, w: number | string) =>
  new Request(`https://site.test/api/img?url=${encodeURIComponent(url)}&w=${w}`)

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co'))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/img', () => {
  it('rejects anything outside the project bucket', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const url of ['https://evil.test/a.jpg', 'https://abc.supabase.co/auth/v1/user', `${photo}/../../x`]) {
      expect((await GET(request(url, 640))).status).toBe(400)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects widths next/image never asks for', async () => {
    expect((await GET(request(photo, 641))).status).toBe(400)
  })

  it('returns a resized, cacheable WebP', async () => {
    const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c33' } }).jpeg().toBuffer()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(original))))
    const response = await GET(request(photo, 640))
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toContain('s-maxage')
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
    expect([meta.width, meta.height]).toEqual([640, 427])
  })

  it('passes a missing image through as a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    expect((await GET(request(photo, 640))).status).toBe(404)
  })
})
