import { describe, expect, it } from 'vitest'
import { canaryMatches } from '@/lib/downscale-image'

const faithful = [[221, 31, 29], [32, 178, 62], [28, 63, 218], [238, 221, 44]]

describe('canaryMatches', () => {
  it('accepts the colours back, slightly shifted by JPEG', () => {
    expect(canaryMatches(faithful)).toBe(true)
  })

  it('rejects the flat brown a fingerprint-protected canvas returns', () => {
    const brown = [140, 115, 95]
    expect(canaryMatches([brown, brown, brown, brown])).toBe(false)
  })

  it('rejects an unreadable canvas', () => {
    expect(canaryMatches([])).toBe(false)
    expect(canaryMatches([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(false)
  })
})
