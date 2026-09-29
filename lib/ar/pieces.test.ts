import { describe, expect, it } from 'vitest'
import { area, centroid, cutIntoPieces, seededRandom, slice } from './pieces'

const square = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
]

describe('slice', () => {
  it('splits a square in half through its center', () => {
    const halves = slice(square, { x: 0, y: 0 }, { x: 0, y: 1 })
    expect(halves).not.toBeNull()
    expect(area(halves![0])).toBeCloseTo(2)
    expect(area(halves![1])).toBeCloseTo(2)
  })

  it('returns null when the line misses the polygon', () => {
    expect(slice(square, { x: 5, y: 0 }, { x: 0, y: 1 })).toBeNull()
  })
})

describe('centroid', () => {
  it('is the center of a centered square', () => {
    const c = centroid(square)
    expect(c.x).toBeCloseTo(0)
    expect(c.y).toBeCloseTo(0)
  })
})

describe('cutIntoPieces', () => {
  it('covers the whole obra with the requested number of pieces', () => {
    const pieces = cutIntoPieces(1, 1.4, 16, seededRandom('una-obra'))
    expect(pieces).toHaveLength(16)
    const total = pieces.reduce((sum, p) => sum + area(p), 0)
    expect(total).toBeCloseTo(1.4)
  })

  it('cuts the same obra the same way every time', () => {
    const a = cutIntoPieces(1, 1, 10, seededRandom('misma'))
    const b = cutIntoPieces(1, 1, 10, seededRandom('misma'))
    expect(a).toEqual(b)
  })

  it('never leaves a sliver', () => {
    const pieces = cutIntoPieces(1, 0.7, 18, seededRandom('otra'))
    const minArea = 0.7 / 18 / 4
    for (const p of pieces) expect(area(p)).toBeGreaterThanOrEqual(minArea)
  })
})
