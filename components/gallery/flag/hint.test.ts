import { describe, expect, it } from 'vitest'
import { FLAG, FLAG_AT } from '../world/mar/mosaic'
import { HINT_FAR, HINT_NEAR, flagDistance, hintAnchor, nearFlag } from './hint'

describe('flag hint', () => {
  it('shows coming close and goes only well past that, so it does not flicker at the edge', () => {
    expect(nearFlag(HINT_NEAR + 0.5, false)).toBe(false)
    expect(nearFlag(HINT_NEAR, false)).toBe(true)
    expect(nearFlag(HINT_NEAR + 0.5, true)).toBe(true)
    expect(nearFlag(HINT_FAR + 0.1, true)).toBe(false)
  })

  it('measures across the floor from where the flag hangs', () => {
    expect(flagDistance(FLAG_AT.x, FLAG_AT.z + 4)).toBeCloseTo(4)
    expect(flagDistance(FLAG_AT.x + 3, FLAG_AT.z - 4)).toBeCloseTo(5)
  })

  it('floats at eye height on the side the visitor looks from, never off the cloth', () => {
    const front = hintAnchor({ y: 1.6, z: FLAG_AT.z + 5 })
    expect(front.x).toBe(FLAG_AT.x)
    expect(front.y).toBeCloseTo(1.45)
    expect(front.z).toBeGreaterThan(FLAG_AT.z)
    expect(hintAnchor({ y: 1.6, z: FLAG_AT.z - 5 }).z).toBeLessThan(FLAG_AT.z)
    // On the upper floor it rises with the visitor, but stays on the cloth.
    expect(hintAnchor({ y: 40, z: 0 }).y).toBeLessThan(FLAG.bottom + FLAG.height)
    expect(hintAnchor({ y: 0, z: 0 }).y).toBeGreaterThan(FLAG.bottom)
  })
})
