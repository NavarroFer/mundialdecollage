import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeLikeEmail, readGalleryIdentity, signGalleryIdentity } from './gallery-identity'

afterEach(() => vi.useRealTimers())

describe('gallery visitor identity', () => {
  it('uses the same identity for capitalization and surrounding whitespace', () => {
    expect(normalizeLikeEmail('  Artista@Example.COM ')).toBe('artista@example.com')
    for (const value of [null, {}, 'bad', 'a@@b.com', 'a b@c.com', `${'a'.repeat(250)}@b.com`]) {
      expect(normalizeLikeEmail(value)).toBeNull()
    }
  })
  it('remembers a signed identity and rejects tampering or a different signing key', () => {
    const token = signGalleryIdentity('a@example.com', 'test-secret')
    expect(readGalleryIdentity(token, 'test-secret')).toBe('a@example.com')
    expect(readGalleryIdentity(token, 'other-secret')).toBeNull()
    expect(readGalleryIdentity(`x${token}`, 'test-secret')).toBeNull()
    expect(readGalleryIdentity(`${token}.extra`, 'test-secret')).toBeNull()
    expect(readGalleryIdentity('invalid', 'test-secret')).toBeNull()
  })
  it('expires remembered identities after one year', () => {
    vi.useFakeTimers()
    const token = signGalleryIdentity('a@example.com', 'secret')
    vi.advanceTimersByTime(366 * 86400000)
    expect(readGalleryIdentity(token, 'secret')).toBeNull()
  })
})
