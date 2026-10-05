import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageStore, type ImageStore } from '@/lib/r2'
import { cachedShareImage } from './share-image-cache'

vi.mock('@/lib/r2', async (original) => ({ ...(await original<typeof import('@/lib/r2')>()), imageStore: vi.fn(() => null) }))

const versioned = 'https://abc.supabase.co/storage/v1/object/public/artworks/u1/1760000000000-0.jpg'
const legacy = 'https://abc.supabase.co/storage/v1/object/public/artworks/legacy/42.jpg'

const memoryStore = () => {
  const files = new Map<string, Buffer>()
  const store: ImageStore = {
    get: vi.fn(async (key) => files.get(key) ?? null),
    put: vi.fn(async (key, body) => void files.set(key, body)),
  }
  vi.mocked(imageStore).mockReturnValue(store)
  return { files, store }
}

const renderer = (complete = true) =>
  vi.fn(async () => ({ image: new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }), complete }))

afterEach(() => {
  vi.mocked(imageStore).mockReturnValue(null)
  vi.unstubAllGlobals()
})

describe('cachedShareImage', () => {
  it('draws every time without R2', async () => {
    const render = renderer()
    await cachedShareImage(['og', 'a'], versioned, render)
    await cachedShareImage(['og', 'a'], versioned, render)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('draws an image once and reads it back after that', async () => {
    const { files } = memoryStore()
    const render = renderer()
    const first = await cachedShareImage(['og', 'a'], versioned, render)
    const again = await cachedShareImage(['og', 'a'], versioned, render)
    expect(render).toHaveBeenCalledOnce()
    expect(files.size).toBe(1)
    expect(again.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await again.arrayBuffer())).toEqual(Buffer.from(await first.arrayBuffer()))
  })

  it('draws anew when what it shows changes', async () => {
    const { files } = memoryStore()
    const render = renderer()
    await cachedShareImage(['og', 'a'], versioned, render)
    await cachedShareImage(['og', 'b'], versioned, render)
    await cachedShareImage(['story', 'a'], versioned, render)
    expect(render).toHaveBeenCalledTimes(3)
    expect(files.size).toBe(3)
  })

  it("doesn't keep an image whose photo failed to load", async () => {
    const { files } = memoryStore()
    const render = renderer(false)
    await cachedShareImage(['og', 'a'], versioned, render)
    await cachedShareImage(['og', 'a'], versioned, render)
    expect(render).toHaveBeenCalledTimes(2)
    expect(files.size).toBe(0)
  })

  it('keys an overwritable photo by its version', async () => {
    const { files } = memoryStore()
    const render = renderer()
    const etag = vi.fn(() => '"v1"')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { headers: { etag: etag() } })))
    await cachedShareImage(['og', 'a'], legacy, render)
    await cachedShareImage(['og', 'a'], legacy, render)
    expect(render).toHaveBeenCalledOnce()

    etag.mockReturnValue('"v2"')
    await cachedShareImage(['og', 'a'], legacy, render)
    expect(render).toHaveBeenCalledTimes(2)
    expect(files.size).toBe(2)
  })

  it("draws without keeping when an overwritable photo's version is unknown", async () => {
    const { files } = memoryStore()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 402 })))
    const render = renderer()
    await cachedShareImage(['og', 'a'], legacy, render)
    expect(render).toHaveBeenCalledOnce()
    expect(files.size).toBe(0)
  })

  it('still draws the image when R2 is down', async () => {
    vi.mocked(imageStore).mockReturnValue({
      get: vi.fn(async () => { throw new Error('down') }),
      put: vi.fn(async () => { throw new Error('down') }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await cachedShareImage(['og', 'a'], versioned, renderer())
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]))
  })
})
