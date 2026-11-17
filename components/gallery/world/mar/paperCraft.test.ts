import { describe, expect, it } from 'vitest'
import { mixHex, tapeOutline, tearLine, tornOutline } from './paperCraft'
import { seeded } from './textures'

describe('tearLine', () => {
  it('starts at the first point, leaves the last for the next side, and wanders off the straight line', () => {
    const points = tearLine([0, 0], [400, 0], 6, seeded(1))
    expect(points[0]).toEqual([0, 0])
    expect(points.some(([x, y]) => x === 400 && y === 0)).toBe(false)
    expect(points.length).toBeGreaterThan(100)
    const ys = points.map(([, y]) => y)
    expect(Math.max(...ys.map(Math.abs))).toBeGreaterThan(1)
    // Each half wanders 0.7 as far as the whole, so the sum is bounded: 6 / (1 - 0.7).
    expect(Math.max(...ys.map(Math.abs))).toBeLessThan(20)
  })
})

describe('tornOutline', () => {
  it('stays close to its rectangle all the way round', () => {
    const points = tornOutline(10, 20, 300, 200, 4, seeded(3))
    for (const [x, y] of points) {
      expect(x).toBeGreaterThan(10 - 16)
      expect(x).toBeLessThan(310 + 16)
      expect(y).toBeGreaterThan(20 - 16)
      expect(y).toBeLessThan(220 + 16)
    }
  })
})

describe('tapeOutline', () => {
  it('keeps the long edges straight and tears the ends in teeth that stay near the ends', () => {
    const length = 160
    const width = 40
    const points = tapeOutline(length, width, 1, seeded(8))
    const ends = points.filter(([x]) => Math.abs(x) > length / 2 - width)
    expect(ends.length).toBeGreaterThan(10)
    for (const [x, y] of points) {
      expect(Math.abs(y)).toBeLessThanOrEqual(width / 2 + 0.5)
      expect(Math.abs(x)).toBeLessThan(length / 2 + width * 0.5)
    }
  })

  it('is the same piece of tape for the same seed', () => {
    expect(tapeOutline(100, 30, 1, seeded(5))).toEqual(tapeOutline(100, 30, 1, seeded(5)))
  })
})

describe('mixHex', () => {
  it('mixes channel by channel', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixHex('#102030', '#305070', 0.5)).toBe('#203850')
  })
})
