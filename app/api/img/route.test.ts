import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageStore, type ImageStore } from '@/lib/r2'
import { GET } from './route'

vi.mock('@/lib/r2', async (original) => ({ ...(await original<typeof import('@/lib/r2')>()), imageStore: vi.fn(() => null) }))

const photo = 'https://abc.supabase.co/storage/v1/object/public/artworks/u1/1-0.jpg'
const request = (url: string, w: number | string) =>
  new Request(`https://site.test/api/img?url=${encodeURIComponent(url)}&w=${w}`)

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co'))
afterEach(() => {
  vi.mocked(imageStore).mockReturnValue(null)
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

describe('GET /api/img with R2', () => {
  // Storage as fetch sees it: HEAD answers with the ETag, GET with the photo.
  const storage = async (etag = '"v1"') => {
    const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c33' } }).jpeg().toBuffer()
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'HEAD'
        ? new Response(null, { headers: { etag } })
        : new Response(new Uint8Array(original), { headers: { 'content-type': 'image/jpeg' } }),
    )
    vi.stubGlobal('fetch', fetch)
    const downloads = () => fetch.mock.calls.filter(([, init]) => init?.method !== 'HEAD').length
    return { fetch, downloads }
  }

  const memoryStore = () => {
    const files = new Map<string, Buffer>()
    const store: ImageStore = {
      get: vi.fn(async (key) => files.get(key) ?? null),
      put: vi.fn(async (key, body) => void files.set(key, body)),
    }
    vi.mocked(imageStore).mockReturnValue(store)
    return { files, store }
  }

  it('downloads a photo from Storage once, whatever widths are asked for', async () => {
    const { downloads } = await storage()
    const { files } = memoryStore()

    const first = await GET(request(photo, 640))
    expect(first.headers.get('content-type')).toBe('image/webp')
    expect(downloads()).toBe(1)
    expect([...files.keys()].map((key) => key.split('/').pop()).sort()).toEqual(['640.webp', 'original'])

    const other = await GET(request(photo, 1080))
    const meta = await sharp(Buffer.from(await other.arrayBuffer())).metadata()
    expect(meta.width).toBe(1080)
    const again = await GET(request(photo, 640))
    expect(Buffer.from(await again.arrayBuffer())).toEqual(Buffer.from(await first.arrayBuffer()))
    expect(downloads()).toBe(1)
  })

  it('fetches a photo again once it has been overwritten in Storage', async () => {
    const { files } = memoryStore()
    await storage('"v1"')
    await GET(request(photo, 640))
    const { downloads } = await storage('"v2"')
    await GET(request(photo, 640))
    expect(downloads()).toBe(1)
    expect(files.size).toBe(4)
  })

  it('still serves the image when R2 is down', async () => {
    const { downloads } = await storage()
    vi.mocked(imageStore).mockReturnValue({
      get: vi.fn(async () => { throw new Error('down') }),
      put: vi.fn(async () => { throw new Error('down') }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await GET(request(photo, 640))
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(downloads()).toBe(1)
  })

  it('passes a missing image through as a 404 without touching R2', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    const { store } = memoryStore()
    expect((await GET(request(photo, 640))).status).toBe(404)
    expect(store.get).not.toHaveBeenCalled()
  })
})
