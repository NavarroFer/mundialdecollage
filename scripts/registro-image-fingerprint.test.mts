import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { registroImageFingerprint } from '../lib/registro-image-fingerprint.ts'

describe('identidad visual de obras importadas', () => {
  it('reconoce la misma imagen aunque el archivo tenga otro formato y metadata', async () => {
    const pixels = Buffer.alloc(64 * 64 * 3)
    for (let i = 0; i < pixels.length; i++) pixels[i] = i % 251
    const image = sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } })
    const original = await image.clone().png().toBuffer()
    const copy = await image.clone().png().withMetadata({ density: 300 }).toBuffer()
    assert.notDeepEqual(original, copy)
    assert.equal(await registroImageFingerprint(original), await registroImageFingerprint(copy))
    const different = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'red' } }).png().toBuffer()
    assert.notEqual(await registroImageFingerprint(original), await registroImageFingerprint(different))
  })
})
