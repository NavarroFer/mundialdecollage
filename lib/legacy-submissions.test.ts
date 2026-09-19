import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { extractDriveFileId, optimizeImage } from './legacy-submissions'
import { MAX_IMAGE_BYTES } from './onboarding-image'

describe('extractDriveFileId', () => {
  it('pulls the file id out of a standard share link', () => {
    expect(
      extractDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing'),
    ).toBe('1AbCdEfGhIjKlMnOp')
  })

  it('works without query params', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/1AbCdEfGh/view')).toBe(
      '1AbCdEfGh',
    )
  })

  it('returns null for a link with no /file/d/ segment', () => {
    expect(extractDriveFileId('https://drive.google.com/drive/folders/1AbCdEfGh')).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(extractDriveFileId('not a url at all')).toBeNull()
    expect(extractDriveFileId('')).toBeNull()
  })
})

describe('optimizeImage', () => {
  it('shrinks an oversized photo to fit under the storage limit', async () => {
    // Random noise, not a flat color: a solid-color PNG would compress to a
    // few KB and never actually exercise the resize path. Random pixels are
    // incompressible, standing in for a heavy real photo's file size.
    const width = 3000
    const height = 3000
    const raw = randomBytes(width * height * 3)
    const oversized = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    expect(oversized.byteLength).toBeGreaterThan(MAX_IMAGE_BYTES)

    const result = await optimizeImage(oversized)
    expect(result).not.toBeNull()
    expect(result!.byteLength).toBeLessThanOrEqual(MAX_IMAGE_BYTES)

    const metadata = await sharp(result!).metadata()
    expect(metadata.format).toBe('jpeg')
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(2000)
  })

  it('returns null for input that is not a real image', async () => {
    const result = await optimizeImage(Buffer.from('this is not an image'))
    expect(result).toBeNull()
  })
})
