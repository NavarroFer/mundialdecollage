import { describe, expect, it } from 'vitest'
import { normalizeLikeEmail } from './gallery-identity'

describe('gallery visitor identity', () => {
  it('uses the same identity for capitalization and surrounding whitespace', () => {
    expect(normalizeLikeEmail('  Artista@Example.COM ')).toBe('artista@example.com')
    for (const value of [null, {}, 'bad', 'a@@b.com', 'a b@c.com', `${'a'.repeat(250)}@b.com`]) {
      expect(normalizeLikeEmail(value)).toBeNull()
    }
  })
})
