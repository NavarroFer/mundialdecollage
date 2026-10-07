import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'
import { artworkStoryImage } from './artwork-share-image'
import { MESSAGES } from '@/lib/i18n/messages'

vi.mock('@/lib/r2', async (original) => ({ ...(await original<typeof import('@/lib/r2')>()), imageStore: vi.fn(() => null) }))
afterEach(() => vi.unstubAllGlobals())

it('exports an opaque 1080×1920 JPEG story with the original layout', async () => {
  const photo = readFileSync('public/banner-mundial.png')
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    if (String(url).startsWith('data:')) return realFetch(url)
    if (String(url).endsWith('.wasm')) return new Response(readFileSync(String(url)), { headers: { 'Content-Type': 'application/wasm' } })
    return new Response(photo)
  }))
  const response = await artworkStoryImage({
    finalist: { profileId: 'id', slug: 'obra', name: 'Artista', countryCode: 'AR', artworkTitle: 'Mi collage', imageUrl: 'https://storage.test/photo.jpg' },
    locale: 'es', m: MESSAGES.es,
  })
  expect(response.headers.get('content-type')).toBe('image/jpeg')
  const body = Buffer.from(await response.arrayBuffer())
  const metadata = await sharp(body).metadata()
  expect([metadata.format, metadata.width, metadata.height, metadata.hasAlpha]).toEqual(['jpeg', 1080, 1920, false])
  // Compare exactly this rendered canvas encoded as PNG, keeping the fixture
  // self-contained. Actual savings depend on the artwork's visual detail.
  const png = await sharp(body).png().toBuffer()
  expect(body.length).toBeLessThan(png.length)
})
