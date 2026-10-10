import { existsSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageSrc, imageSrcSet } from './image-src'
import { BRAND_IMAGES, brandFile, brandWidths } from './brand-images.mjs'

const photo = 'https://abc.supabase.co/storage/v1/object/public/artworks/u1/1-0.jpg'

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co'))
afterEach(() => vi.unstubAllEnvs())

describe('imageSrc', () => {
  it('sends Storage photos through /api/img at the next allowed width', () => {
    expect(imageSrc(photo, 300)).toBe(`/api/img?url=${encodeURIComponent(photo)}&w=384`)
    expect(imageSrc(photo, 1080)).toContain('&w=1080')
  })

  it('caps the width at the largest allowed one', () => {
    expect(imageSrc(photo, 4000)).toContain('&w=1920')
  })

  it('offers allowed derivatives with matching width descriptors', () => {
    expect(imageSrcSet(photo)).toContain(`${imageSrc(photo, 384)} 384w`)
    expect(imageSrcSet(photo)).toContain(`${imageSrc(photo, 640)} 640w`)
    expect(imageSrcSet('/banner-mundial.png')).toBeUndefined()
  })

  it('leaves local files, previews and other hosts alone', () => {
    for (const src of ['/banner-mundial.png', 'blob:https://x/1', 'https://other.supabase.co/storage/v1/object/public/a.jpg']) {
      expect(imageSrc(src, 640)).toBe(src)
    }
  })

  it('serves brand images as the WebP copy at the next width, the original size at most', () => {
    expect(imageSrc('/logo.png', 300)).toBe('/brand/logo-384.webp')
    expect(imageSrc('/logo-mark.png', 120)).toBe('/brand/logo-mark-128.webp')
    expect(imageSrc('/logo-mark.png', 1080)).toBe('/brand/logo-mark-512.webp')
    expect(imageSrc('/logo.png', 1920)).toBe('/brand/logo-1415.webp')
  })

  // A copy the loader can ask for but scripts/brand-images.mjs didn't write would be a broken logo.
  it('has every brand copy on disk', () => {
    for (const { name, width } of Object.values(BRAND_IMAGES)) {
      for (const w of brandWidths(width)) expect(existsSync(`public${brandFile(name, w)}`), brandFile(name, w)).toBe(true)
    }
  })
})
