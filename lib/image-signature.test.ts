import { describe, expect, it } from 'vitest'
import { hasImageSignature, isRealImage } from './image-signature'

const bytes = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0))

describe('hasImageSignature', () => {
  it('accepts JPEG, PNG, GIF and WebP', () => {
    expect(hasImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe(true)
    expect(hasImageSignature(Uint8Array.from([0x89, ...bytes('PNG\r\n'), 0x1a, 0x0a]))).toBe(true)
    expect(hasImageSignature(bytes('GIF89a'))).toBe(true)
    expect(hasImageSignature(bytes('RIFF\0\0\0\0WEBPVP8 '))).toBe(true)
  })

  it('rejects a Photoshop file, whatever it is called', () => {
    expect(hasImageSignature(bytes('8BPS\0\x01\0\0\0\0\0\0'))).toBe(false)
  })

  it('rejects empty and WAV-like RIFF files', () => {
    expect(hasImageSignature(new Uint8Array())).toBe(false)
    expect(hasImageSignature(bytes('RIFF\0\0\0\0WAVEfmt '))).toBe(false)
  })
})

describe('isRealImage', () => {
  it('reads the start of a picked file', async () => {
    expect(await isRealImage(new Blob([bytes('8BPS\0\x01\0\0\0\0\0\0')], { type: 'image/jpeg' }))).toBe(false)
    expect(await isRealImage(new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }))).toBe(true)
  })
})
